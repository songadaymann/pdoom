// Clearance graph sampled from E1M4 sector polygons, not the Intake grid.
// Native TryMove is authoritative for actor collision and moving doors.
class PDCheckpointNav : Object play
{
    Array<int> Costs;
    Array<int> Stamps; // Costs[n] belongs to the current field only while Stamps[n] == Stamp.
    Array<int> Queue;
    int Stamp;
    int Goal;
    bool Ready;
    bool Partial;  // The field stops a little past the mover instead of covering the map.
    bool Stranded; // The last search covered everything it could reach but not the mover.
    bool Human;
    int MaintenanceVersion;
    int LinkAt(PDCheckpoint game, int node) { return Human ? game.HumanLinks[node] : game.Links[node]; }
    int Waypoint;
    bool HasWaypoint;
    bool AvoidThreat;
    Vector2 Threat;
    int ThreatVersion;

    int CostAt(int node) { return node >= 0 && node < Stamps.Size() && Stamps[node] == Stamp ? Costs[node] : -1; }

    // A route may leave an already dangerous area, but never cross back through
    // the hunter to reach a seemingly safe destination on the other side.
    bool ThreatBlocks(Vector2 from, Vector2 to)
    {
        if (!AvoidThreat) return false;
        Vector2 step = to-from, relative = Threat-from;
        double length2 = step.X*step.X+step.Y*step.Y;
        if (length2 < 1) return false;
        double fraction = clamp((relative.X*step.X+relative.Y*step.Y)/length2,0.,1.);
        if ((from+step*fraction-Threat).Length() >= 112) return false;
        return (from-Threat).Length() >= 112 || (to-Threat).Length() <= (from-Threat).Length();
    }

    bool MaintenanceBlocked(PDCheckpoint game, int node)
    {
        // Only door cells can be locked; plain floor skips the door lookups.
        int door = game.Doors[node];
        if(door!=0&&game.Intro.Locked(game,door))return true;
        if(PDCampaignSession.Hal())return door!=0&&game.Cast.DoorLocked(door);
        if (!game.Holly.BridgeUp)
        {
            Vector2 point = PDCheckpointMap.Center(node);
            if (point.X > -1216 && point.X < -1024 && point.Y > 1824 && point.Y < 1952) return true;
        }
        return door == 886 && !game.Sam.Opened ||
            door == 879 && !game.Cast.People[2].Released;
    }

    // Links are symmetric, so a short search out from the mover proves it is
    // still cut off (a pocket, a sealed room) without flooding the whole map.
    bool CutOff(PDCheckpoint game, int start, int goal, int count, int width)
    {
        Stamp++;
        int head = 0, tail = 0;
        Stamps[start] = Stamp; Queue[tail++] = start;
        while (head < tail)
        {
            int at = Queue[head++];
            if (at == goal || tail > 256) return false;
            int links = LinkAt(game, at);
            for (int d = 0; d < 4; d++)
            {
                if (!(links & (1 << d))) continue;
                int neighbor = at + ((d == 0) ? 1 : (d == 1) ? -1 : (d == 2) ? width : -width);
                if (neighbor < 0 || neighbor >= count || Stamps[neighbor] == Stamp || MaintenanceBlocked(game, neighbor)) continue;
                Stamps[neighbor] = Stamp; Queue[tail++] = neighbor;
            }
        }
        return true;
    }

    // A new goal cell (or door/threat state) only invalidates the field. It is
    // flooded from the goal when the mover next needs a step, and only until
    // it covers the mover's own cell plus two rings, so a follower a few cells
    // behind the player re-routes over dozens of cells instead of the whole map.
    void Build(PDCheckpoint game, Vector2 target, int start = -1)
    {
        int nodeIndex = game.NodeAt(target, Human);
        int doorState = (game.Sam.Opened ? 1 : 0) + (game.Cast.People[2].Released ? 2 : 0);
        if (!PDCampaignSession.Hal() && game.Holly.BridgeUp) doorState += 4;
        if(game.Intro.Opened)doorState+=8;
        int threatState = AvoidThreat ? level.time/7+1 : 0;
        if (Ready && Goal == nodeIndex && MaintenanceVersion == doorState && ThreatVersion == threatState)
        {
            if (start < 0 || !Partial || CostAt(start) >= 0) return;
        }
        else
        {
            ThreatVersion = threatState;
            if (MaintenanceVersion != doorState) HasWaypoint = false;
            MaintenanceVersion = doorState;
            Ready = true; Goal = nodeIndex;
        }
        int count = game.Links.Size(), width = PDCheckpointMap.Width();
        if (Stamps.Size() != count)
        {
            Costs.Resize(count); Stamps.Resize(count); Queue.Resize(count);
            for (int i = 0; i < count; i++) Stamps[i] = 0;
            Stamp = 0;
        }
        int head = 0, tail = 0, limit = 0x7FFFFFFF;
        if (Stranded && start >= 0 && nodeIndex >= 0 && CutOff(game, start, nodeIndex, count, width))
        { Stamp++; Partial = false; return; }
        Stamp++; Partial = nodeIndex >= 0;
        if (start < 0 || nodeIndex < 0) return;
        Partial = false;
        Costs[nodeIndex] = 0; Stamps[nodeIndex] = Stamp; Queue[tail++] = nodeIndex;
        while (head < tail)
        {
            int at = Queue[head++], cost = Costs[at];
            if (cost > limit) { Partial = true; break; }
            if (at == start) limit = cost + 2;
            // Neighbours are checked before they are queued; only the goal can be blocked here.
            if (at == nodeIndex && MaintenanceBlocked(game, at)) continue;
            int links = LinkAt(game, at);
            for (int d = 0; d < 4; d++)
            {
                if (!(links & (1 << d))) continue;
                int neighbor = at + ((d == 0) ? 1 : (d == 1) ? -1 : (d == 2) ? width : -width);
                if (neighbor < 0 || neighbor >= count || Stamps[neighbor] == Stamp || MaintenanceBlocked(game, neighbor) ||
                    AvoidThreat && ThreatBlocks(PDCheckpointMap.Center(neighbor),PDCheckpointMap.Center(at))) continue;
                Costs[neighbor] = cost + 1; Stamps[neighbor] = Stamp; Queue[tail++] = neighbor;
            }
        }
        Stranded = !Partial && CostAt(start) < 0;
    }

    Vector2 Next(PDCheckpoint game, Vector2 from, Vector2 target)
    {
        Build(game, target);
        // Finish each short segment before turning. Selecting the next grid
        // cell halfway through a move cuts corners into original props.
        if (HasWaypoint)
        {
            Vector2 point = PDCheckpointMap.Center(Waypoint);
            double remaining = (point - from).Length();
            if (remaining > 2 && remaining < PDCheckpointMap.Step() * 2 && !ThreatBlocks(from,point)) return point;
            HasWaypoint = false;
        }
        int nodeIndex = game.NodeAt(from, Human);
        if (nodeIndex < 0 || nodeIndex == Goal) return target;
        if (Partial && CostAt(nodeIndex) < 0) Build(game, target, nodeIndex);
        int best = 99999, selected = -1, links = LinkAt(game, nodeIndex), width = PDCheckpointMap.Width();
        for (int d = 0; d < 4; d++)
        {
            if (!(links & (1 << d))) continue;
            int neighbor = nodeIndex + ((d == 0) ? 1 : (d == 1) ? -1 : (d == 2) ? width : -width);
            int cost = CostAt(neighbor);
            if (cost >= 0 && cost < best && !ThreatBlocks(from,PDCheckpointMap.Center(neighbor)))
            { best = cost; selected = neighbor; }
        }
        if (selected < 0) return from;
        Waypoint = selected; HasWaypoint = true;
        return PDCheckpointMap.Center(selected);
    }
}
