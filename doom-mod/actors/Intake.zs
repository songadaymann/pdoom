class PDPerson : Object play
{
    Actor Body;
    bool Alive;
    bool Safe;
    bool Gun;
    bool Charge;
    int Ammo;
    int ShotUntil;
    bool Walking;
}

// The cell graph routes actors; Doom checks their movement and sightlines.
class PDNav : Object play
{
    Array<int> Costs;
    Array<int> Queue;
    int GoalCell;
    int Revision;
    bool Ready;
    bool ForHunter;

    void Build(PDGame game, Vector2 goal, bool hunter = false)
    {
        int width = PDMap.Width(), height = PDMap.Height();
        int nodeIndex = game.CellAt(goal);
        if (Ready && GoalCell == nodeIndex && Revision == game.Revision && ForHunter == hunter) return;
        Ready = true; GoalCell = nodeIndex; Revision = game.Revision; ForHunter = hunter;
        Costs.Resize(width * height); Queue.Resize(width * height);
        for (int i = 0; i < Costs.Size(); i++) Costs[i] = -1;
        if (nodeIndex < 0) return;
        int head = 0, tail = 0;
        Costs[nodeIndex] = 0; Queue[tail++] = nodeIndex;
        while (head < tail)
        {
            int at = Queue[head++];
            int gx = at % width, gy = at / width;
            for (int d = 0; d < 4; d++)
            {
                int nx = gx + ((d == 0) ? 1 : (d == 1) ? -1 : 0);
                int ny = gy + ((d == 2) ? 1 : (d == 3) ? -1 : 0);
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                int neighborIndex = ny * width + nx;
                if (Costs[neighborIndex] >= 0 || !game.Passable(PDMap.Kind(nx, ny), hunter)) continue;
                Costs[neighborIndex] = Costs[at] + 1; Queue[tail++] = neighborIndex;
            }
        }
    }

    Vector2 Next(PDGame game, Vector2 from, Vector2 goal)
    {
        int nodeIndex = game.CellAt(from);
        if (nodeIndex < 0 || nodeIndex == GoalCell) return goal;
        int width = PDMap.Width(), gx = nodeIndex % width, gy = nodeIndex / width;
        int best = 99999, selected = -1;
        for (int d = 0; d < 4; d++)
        {
            int nx = gx + ((d == 0) ? 1 : (d == 1) ? -1 : 0);
            int ny = gy + ((d == 2) ? 1 : (d == 3) ? -1 : 0);
            if (nx < 0 || nx >= width || ny < 0 || ny >= PDMap.Height()) continue;
            int neighborIndex = ny * width + nx;
            if (Costs[neighborIndex] >= 0 && Costs[neighborIndex] < best) { best = Costs[neighborIndex]; selected = neighborIndex; }
        }
        if (selected < 0) return from;
        return PDMap.CellCenter(selected);
    }
}

class PDGame : EventHandler
{
    Array<PDPerson> People;
    PDHunter Hunter;
    PDNav FollowNav;
    PDNav HunterNav;
    PDNav EvacuateNav;
    bool Initialized;
    bool Ended;
    bool Awake;
    bool Holding;
    bool DoorOpen;
    bool BreachOpen;
    bool RelayOpen;
    bool CartMoved;
    int Controlled;
    int Revision;
    int OldButtons;
    int WakeAt;
    int FuseUntil;
    Actor FuseVisual;
    Vector3 FusePosition;
    Vector2 HoldGoal;
    Vector2 LastKnown;
    String Message;
    int MessageUntil;
    String Result;

    static PDGame Get() { return PDGame(EventHandler.Find('PDGame')); }
    int CellAt(Vector2 position)
    {
        int x = int(floor(position.X / PDMap.CellSize()));
        int y = int(floor(position.Y / PDMap.CellSize()));
        if (x < 0 || x >= PDMap.Width() || y < 0 || y >= PDMap.Height()) return -1;
        return y * PDMap.Width() + x;
    }
    int KindAt(Vector2 position)
    {
        int c = CellAt(position);
        if (c < 0) return 0;
        return PDMap.Kind(c % PDMap.Width(), c / PDMap.Width());
    }
    bool Passable(int kind, bool hunter = false)
    {
        if (kind == 0) return false;
        if (kind == 4) return DoorOpen || hunter;
        if (kind == 5) return BreachOpen;
        if (kind == 6) return RelayOpen;
        if (kind == 8) return CartMoved;
        return true;
    }
    bool GridSight(Vector2 from, Vector2 to)
    {
        double distance = (to - from).Length();
        int count = max(1, int(distance / 16));
        for (int i = 1; i < count; i++)
        {
            Vector2 p = from + (to - from) * (double(i) / count);
            if (!Passable(KindAt(p)) || !Passable(KindAt(p + (18, 18))) ||
                !Passable(KindAt(p + (-18, 18))) || !Passable(KindAt(p + (18, -18))) ||
                !Passable(KindAt(p + (-18, -18)))) return false;
        }
        return true;
    }
    void Say(String text, int duration = 140)
    {
        Message = text; MessageUntil = level.time + duration;
        Console.Printf("PDOOM_MESSAGE %s", text);
    }
    void Alert(Vector2 at, bool wake = true)
    {
        LastKnown = at;
        if (wake && !Awake) { Awake = true; WakeAt = level.time; Say("A machine wakes. Break its line of sight.", 175); }
    }
    int SavedCount()
    {
        int n = 0; for (int i = 0; i < People.Size(); i++) if (People[i].Safe) n++; return n;
    }
    int AliveCount()
    {
        int n = 0; for (int i = 0; i < People.Size(); i++) if (People[i].Alive) n++; return n;
    }
    int RemainingCount() { return AliveCount() - SavedCount(); }

    override void WorldLoaded(WorldEvent e)
    {
        if (level.MapName != "E1M1") { Initialized = false; return; }
        if (Initialized) return;
        People.Resize(6);
        for (int i = 0; i < 6; i++) { People[i] = new('PDPerson'); People[i].Alive = true; }
        People[0].Body = players[0].mo;
        let iter = ThinkerIterator.Create('PDCompanion');
        PDCompanion companion; int n = 1;
        while ((companion = PDCompanion(iter.Next())) != null && n < 6)
        { companion.PersonId = n; People[n++].Body = companion; }
        for (int i = n; i < 6; i++) People[i].Alive = false;
        let hunters = ThinkerIterator.Create('PDHunter'); Hunter = PDHunter(hunters.Next());
        FollowNav = new('PDNav'); HunterNav = new('PDNav'); EvacuateNav = new('PDNav');
        HoldGoal = players[0].mo.Pos.XY;
        LastKnown = Hunter ? Hunter.Pos.XY : HoldGoal;
        Initialized = true;
        Console.Printf("PDOOM_MOD_LOADED intake-v1");
        Say("Six people. Stay together. Try the cart or the open hall.", 210);
    }

    override void NetworkProcess(ConsoleEvent e)
    {
        if (!Initialized || Ended) return;
        if (e.Name == "pdoom_order") ToggleOrder();
        if (e.Name == "pdoom_give") GiveGun();
        if (e.Name == "pdoom_finish" && SavedCount() > 0) Finish();
    }

    override void WorldThingDied(WorldEvent e)
    {
        if (!Initialized || Ended) return;
        for (int i = 0; i < People.Size(); i++)
            if (People[i].Body == e.Thing && People[i].Alive && !People[i].Safe) KillPerson(i);
    }

    void ToggleOrder()
    {
        Holding = !Holding;
        if (Holding)
        {
            HoldGoal = players[0].mo.Pos.XY;
            if (Hunter && Awake && Hunter.CheckSight(players[0].mo))
            {
                Vector2 origin = HoldGoal; double best = 999999;
                for (int c = 0; c < PDMap.Width() * PDMap.Height(); c++)
                {
                    Vector2 p = PDMap.CellCenter(c);
                    double distance = (p - origin).Length();
                    if (distance < best && distance < 512 && Passable(KindAt(p)) &&
                        GridSight(origin, p) && !GridSight(Hunter.Pos.XY, p))
                    { best = distance; HoldGoal = p; }
                }
            }
            Say("Hold. Gather in shelter nearby.");
        }
        else Say("Follow me.");
    }

    PDProp TargetProp()
    {
        let pawn = players[0].mo;
        let props = ThinkerIterator.Create('PDProp'); PDProp prop;
        PDProp best = null; double score = -99999;
        while ((prop = PDProp(props.Next())) != null)
        {
            if (prop.Used || pawn.Distance2D(prop) > 160 || !pawn.CheckSight(prop)) continue;
            double facing = cos(pawn.AngleTo(prop) - pawn.Angle);
            if (facing < 0.05) continue;
            double rating = facing * 180 - pawn.Distance2D(prop);
            if (rating > score) { score = rating; best = prop; }
        }
        return best;
    }
    String Prompt(PDProp prop)
    {
        if (!prop) return "";
        if (prop.PropKind == 1) return "SPACE - smash camera";
        if (prop.PropKind == 2) return "SPACE - push cart";
        if (prop.PropKind == 3) return "SPACE - take demolition charge";
        if (prop.PropKind == 4) return FuseUntil > 0 ? "Fuse burning - move back" : People[Controlled].Charge ? "SPACE - plant charge on cracked wall" : "Cracked wall - needs a charge";
        if (prop.PropKind == 5) return "SPACE - take gun";
        if (prop.PropKind == 6) return "SPACE - pull outside relay";
        if (prop.PropKind == 7) return "SPACE - take two spare rounds";
        if (prop.PropKind == 8) return DoorOpen ? "SPACE - close heavy door" : "SPACE - open heavy door";
        return "";
    }

    void SmashCamera(PDProp prop)
    {
        prop.Used = true; prop.SetStateLabel('Broken');
        prop.A_StartSound("weapons/pistol", CHAN_BODY);
        Alert(prop.Pos.XY); Say("Glass. Sparks. This camera is blind.");
    }
    void UseProp()
    {
        let prop = TargetProp();
        if (!prop) return;
        let person = People[Controlled];
        switch (prop.PropKind)
        {
        case 1: SmashCamera(prop); break;
        case 2:
            CartMoved = true; prop.Used = true; Revision++;
            Door_Open(40, 32);
            Vector2 parking = PDMap.CartParking();
            prop.SetOrigin((parking.X, parking.Y, prop.Pos.Z), false);
            Alert(prop.Pos.XY, false); Say("The cart scrapes aside. A service passage and a shelf.");
            break;
        case 3:
            person.Charge = true; prop.Used = true; prop.Destroy(); Say("A demolition charge. Look for cracked masonry.");
            break;
        case 4:
            if (BreachOpen || FuseUntil > 0) break;
            if (!person.Charge) { Say("Cracked masonry. You need a demolition charge."); break; }
            person.Charge = false; FuseUntil = level.time + 140; FusePosition = prop.Pos;
            FuseVisual = Actor.Spawn('PDBurningCharge', FusePosition + (0, 0, 24));
            Alert(prop.Pos.XY); Say("Four-second fuse. Get everyone away from the wall!", 140);
            break;
        case 5:
            if (person.Gun) { Say("You already have the gun."); break; }
            person.Gun = true; person.Ammo += prop.StoredAmmo; prop.Used = true; prop.Destroy();
            Say("A gun. G gives it to someone nearby. Shots interrupt the machine.", 175);
            break;
        case 6:
            RelayOpen = true; prop.Used = true; Revision++; Door_Open(30, 24);
            let cameras = ThinkerIterator.Create('PDCamera'); PDCamera camera;
            while ((camera = PDCamera(cameras.Next())) != null) { camera.Used = true; camera.SetStateLabel('Broken'); }
            Say("Surveillance falls silent. The short rescue gate is open.", 175);
            break;
        case 7:
            person.Ammo += prop.StoredAmmo; prop.Used = true; prop.Destroy(); Say("Spare rounds. Every shot counts.");
            break;
        case 8:
            DoorOpen = !DoorOpen; Revision++;
            if (DoorOpen) Door_Open(10, 24); else Door_Close(10, 16);
            Say(DoorOpen ? "The heavy door opens." : "The heavy door closes.");
            break;
        }
    }

    void GiveGun()
    {
        let person = People[Controlled];
        if (!person.Gun) { Say("Carry a gun, then get close to a companion."); return; }
        int best = -1; double distance = 180;
        for (int i = 0; i < People.Size(); i++)
        {
            let other = People[i];
            if (i == Controlled || !other.Alive || other.Safe || other.Gun || !other.Body) continue;
            double d = person.Body.Distance2D(other.Body);
            if (d < distance && person.Body.CheckSight(other.Body)) { best = i; distance = d; }
        }
        if (best < 0) { Say("Get closer to a living companion."); return; }
        People[best].Gun = true; People[best].Ammo += person.Ammo;
        person.Gun = false; person.Ammo = 0;
        Say("They take the gun. They will interrupt the machine when it aims.", 175);
    }
    void StunHunter()
    {
        if (!Hunter || level.time < Hunter.ImmuneUntil) return;
        Hunter.StunUntil = level.time + 53;
        Hunter.ImmuneUntil = level.time + 123;
        Hunter.AimTics = 0; Hunter.Mood = 3; Hunter.SetStateLabel('Stun');
    }
    void Attack()
    {
        let person = People[Controlled]; let pawn = person.Body;
        if (level.time < person.ShotUntil) return;
        let prop = TargetProp();
        if (!person.Gun)
        {
            person.ShotUntil = level.time + 15;
            if (prop && prop.PropKind == 1) SmashCamera(prop);
            else Say("Empty hands. Find a gun or try an object with E.", 70);
            return;
        }
        if (person.Ammo <= 0) { Say("Empty. The cart concealed two spare rounds."); return; }
        person.Ammo--; person.ShotUntil = level.time + 28;
        pawn.A_StartSound("weapons/shotgf", CHAN_WEAPON);
        Alert(pawn.Pos.XY);
        if (prop && prop.PropKind == 1) { SmashCamera(prop); return; }
        if (Hunter && pawn.Distance2D(Hunter) < 1400 && cos(pawn.AngleTo(Hunter) - pawn.Angle) > 0.92 && pawn.CheckSight(Hunter))
        { StunHunter(); Say(level.time < Hunter.StunUntil ? "It staggers. Run." : "It braces against another hit. Keep moving.", 70); }
        else Say("The shot echoes.", 70);
    }

    void MoveActor(Actor body, Vector2 goal, double speed, PDNav nav, bool isHunter = false)
    {
        if ((goal - body.Pos.XY).Length() < 12) return;
        nav.Build(self, goal, isHunter);
        Vector2 destination = goal;
        if (!GridSight(body.Pos.XY, goal)) destination = nav.Next(self, body.Pos.XY, goal);
        Vector2 direction = destination - body.Pos.XY;
        double distance = direction.Length();
        if (distance < 1) return;
        if (isHunter && KindAt(destination) == 4 && !DoorOpen && distance < 180)
        {
            Hunter.DoorWait++;
            if (Hunter.DoorWait >= 70) { DoorOpen = true; Revision++; Door_Open(10, 16); Hunter.DoorWait = 0; Say("The machine forces the heavy door open.", 105); }
            return;
        }
        body.Angle = atan2(direction.Y, direction.X);
        Vector2 delta = direction / distance * min(speed, distance);
        if (!body.TryMove(body.Pos.XY + delta, 0))
        {
            Vector2 center = PDMap.CellCenter(max(0, CellAt(body.Pos.XY)));
            Vector2 recenter = center - body.Pos.XY;
            if (recenter.Length() > 8)
                body.TryMove(body.Pos.XY + recenter / recenter.Length() * speed, 0);
        }
    }

    void TickPeople()
    {
        let pawn = players[0].mo;
        Vector2 goal = Holding ? HoldGoal : pawn.Pos.XY;
        for (int i = 0; i < People.Size(); i++)
        {
            let person = People[i];
            if (!person.Alive || person.Safe || !person.Body) continue;
            if (i != Controlled)
            {
                Vector2 destination = goal;
                bool fleeFuse = FuseUntil > 0 && (person.Body.Pos.XY - FusePosition.XY).Length() < 300;
                if (fleeFuse)
                {
                    double best = 999999;
                    for (int c = 0; c < PDMap.Width() * PDMap.Height(); c++)
                    {
                        Vector2 p = PDMap.CellCenter(c);
                        double d = (p - person.Body.Pos.XY).Length();
                        if (d < best && Passable(KindAt(p)) && (p - FusePosition.XY).Length() > 340 && GridSight(person.Body.Pos.XY, p))
                        { best = d; destination = p; }
                    }
                }
                bool moving = (person.Body.Pos.XY - destination).Length() > (fleeFuse ? 12 : 54 + i * 3);
                if (moving != person.Walking)
                {
                    if (moving) person.Body.SetStateLabel('Walk'); else person.Body.SetStateLabel('Spawn');
                    person.Walking = moving;
                }
                if (moving) MoveActor(person.Body, destination, 4.8, fleeFuse ? EvacuateNav : FollowNav);
                if (person.Gun && person.Ammo > 0 && Hunter && Hunter.AimTics >= 42 &&
                    level.time >= person.ShotUntil && level.time >= Hunter.ImmuneUntil && person.Body.CheckSight(Hunter))
                {
                    person.Ammo--; person.ShotUntil = level.time + 105;
                    person.Body.A_StartSound("weapons/shotgf", CHAN_WEAPON); StunHunter();
                    Say("Your armed companion interrupts its shot.", 70);
                }
            }
            if (KindAt(person.Body.Pos.XY) == 7) SavePerson(i);
        }
    }

    void SeparatePeople()
    {
        for (int i = 0; i < People.Size(); i++)
        {
            let first = People[i];
            if (!first.Alive || first.Safe || !first.Body) continue;
            for (int j = i + 1; j < People.Size(); j++)
            {
                let second = People[j];
                if (!second.Alive || second.Safe || !second.Body) continue;
                Vector2 away = first.Body.Pos.XY - second.Body.Pos.XY;
                double distance = away.Length();
                if (distance >= 38) continue;
                // A small stable sideways bias separates a perfectly aligned
                // queue instead of leaving five transparent bodies in a stack.
                if (abs(away.X) < 1) away.X = ((i + j) % 2 == 0) ? 4 : -4;
                if (away.Length() < 1) away.Y = 1;
                Vector2 push = away / away.Length() * min(1.8, (38 - distance) * 0.16);
                if (i != Controlled) first.Body.TryMove(first.Body.Pos.XY + push, 0);
                if (j != Controlled) second.Body.TryMove(second.Body.Pos.XY - push, 0);
            }
        }
    }

    void TickHunter()
    {
        if (!Hunter || !Awake || Ended) return;
        if (level.time < Hunter.StunUntil) return;
        int prey = -1; double nearest = 1000;
        for (int i = 0; i < People.Size(); i++)
        {
            let person = People[i];
            if (!person.Alive || person.Safe || !person.Body) continue;
            double distance = Hunter.Distance2D(person.Body);
            if (distance < nearest && Hunter.CheckSight(person.Body)) { nearest = distance; prey = i; }
        }
        if (prey >= 0)
        {
            let body = People[prey].Body; LastKnown = body.Pos.XY;
            if (Hunter.PreyId != prey) Hunter.AimTics = 0;
            Hunter.PreyId = prey;
            Hunter.Angle = Hunter.AngleTo(body);
            if (level.time >= Hunter.ReloadUntil && level.time - WakeAt > 140)
            {
                if (Hunter.Mood != 2) { Hunter.Mood = 2; Hunter.SetStateLabel('Aim'); Hunter.A_StartSound("weapons/plasmaf", CHAN_VOICE); }
                Hunter.AimTics++;
                if (Hunter.AimTics >= 91)
                {
                    Hunter.A_StartSound("weapons/shotgf", CHAN_WEAPON);
                    Hunter.AimTics = 0; Hunter.ReloadUntil = level.time + 70;
                    KillPerson(prey);
                }
                return;
            }
        }
        else { Hunter.AimTics = 0; Hunter.PreyId = -1; }
        if (Hunter.Mood != 1) { Hunter.Mood = 1; Hunter.SetStateLabel('Walk'); }
        Vector2 previous = Hunter.Pos.XY;
        MoveActor(Hunter, LastKnown, 2.8, HunterNav, true);
        Hunter.MovementFootsteps(previous);
        if (level.time % 7 == 0 && !RelayOpen)
        {
            let cameras = ThinkerIterator.Create('PDCamera'); PDCamera camera;
            while ((camera = PDCamera(cameras.Next())) != null)
            {
                if (camera.Used) continue;
                camera.Angle = (level.time * 1.4) % 360;
                for (int i = 0; i < People.Size(); i++)
                {
                    let person = People[i];
                    if (person.Alive && !person.Safe && person.Body && camera.Distance2D(person.Body) < 800 &&
                        cos(camera.AngleTo(person.Body) - camera.Angle) > 0.25 && camera.CheckSight(person.Body))
                        LastKnown = person.Body.Pos.XY;
                }
            }
        }
    }

    void TickFuse()
    {
        if (FuseUntil <= 0 || level.time < FuseUntil) return;
        FuseUntil = 0; BreachOpen = true; Revision++; Door_Open(20, 64);
        let walls = ThinkerIterator.Create('PDCrackedWall');
        PDCrackedWall wall;
        while ((wall = PDCrackedWall(walls.Next())) != null) wall.Used = true;
        if (FuseVisual) { FuseVisual.Destroy(); FuseVisual = null; }
        Actor blast = Actor.Spawn('PDExplosion', FusePosition + (0, 0, 24));
        // Explicit damage preserves the six-person ledger and control transfer.
        for (int i = 0; i < People.Size(); i++)
            if (People[i].Alive && !People[i].Safe && People[i].Body &&
                (People[i].Body.Pos.XY - FusePosition.XY).Length() < 210 &&
                blast && blast.CheckSight(People[i].Body)) KillPerson(i);
        if (Hunter && (Hunter.Pos.XY - FusePosition.XY).Length() < 350) StunHunter();
        Alert(FusePosition.XY); Say("The partition gives way. Both sides can use the breach.", 140);
    }

    void DropEquipment(PDPerson person, Vector3 at)
    {
        if (person.Gun)
        {
            PDGun gun = PDGun(Actor.Spawn('PDGun', at));
            if (gun) gun.StoredAmmo = person.Ammo;
        }
        else if (person.Ammo > 0)
        {
            PDAmmo rounds = PDAmmo(Actor.Spawn('PDAmmo', at));
            if (rounds) rounds.StoredAmmo = person.Ammo;
        }
        if (person.Charge) Actor.Spawn('PDCharge', at);
        person.Gun = false; person.Ammo = 0; person.Charge = false;
    }
    void KillPerson(int id)
    {
        if (id < 0 || id >= People.Size() || !People[id].Alive || People[id].Safe || Ended) return;
        let person = People[id]; Vector3 at = person.Body.Pos;
        person.Alive = false; DropEquipment(person, at);
        if (id == Controlled)
        {
            Actor.Spawn('PDDeadHuman', at);
            TransferControl(at, false);
        }
        else
        {
            person.Body.bShootable = false; person.Body.bSolid = false;
            person.Body.health = 0; person.Body.SetStateLabel('Death');
            Say("Someone is gone. Their equipment is still there.", 140);
            if (RemainingCount() == 0) Finish();
        }
    }
    void SavePerson(int id)
    {
        let person = People[id];
        if (!person.Alive || person.Safe) return;
        person.Safe = true; Vector3 at = person.Body.Pos;
        if (id == Controlled)
        {
            person.Body = Actor.Spawn('PDSavedHuman', at);
            TransferControl(at, true);
        }
        else
        {
            person.Body.bShootable = false; person.Body.bSolid = false;
            person.Body.SetStateLabel('Spawn'); Say("One person is permanently safe.");
            if (RemainingCount() == 0) Finish();
        }
    }
    void TransferControl(Vector3 from, bool saved)
    {
        int next = -1; double best = 999999;
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            if (!p.Alive || p.Safe || !p.Body) continue;
            double distance = (p.Body.Pos.XY - from.XY).Length();
            if (Hunter && Hunter.CheckSight(p.Body)) distance += 256;
            if (distance < best) { next = i; best = distance; }
        }
        if (next < 0) { Finish(); return; }
        let pawn = players[0].mo; let body = People[next].Body;
        Vector3 destination = body.Pos; double angle = body.Angle;
        body.Destroy();
        Controlled = next; People[next].Body = pawn; People[next].Walking = false;
        pawn.SetOrigin(destination, false); pawn.Vel = (0, 0, 0); pawn.Angle = angle;
        pawn.health = 100; pawn.player.health = 100;
        Say(saved ? "Safe. You are someone still inside now." : "Gone. You are another survivor now.", 175);
    }
    void Finish()
    {
        if (Ended) return;
        Ended = true; Result = SavedCount() > 0 ? "rescued" : "lost";
        players[0].mo.player.cheats |= CF_TOTALLYFROZEN;
        Console.Printf("PDOOM_RESULT {\"outcome\":\"%s\",\"saved\":%d,\"total\":6,\"alive\":%d}", Result, SavedCount(), AliveCount());
    }

    void Report()
    {
        let pawn = players[0].mo; let person = People[Controlled];
        String prompt = Ended ? "" : Prompt(TargetProp());
        String message = level.time < MessageUntil ? Message : "";
        int cameras = 0;
        int outsidePeople = 0;
        String humanPositions = "[";
        for (int i = 0; i < People.Size(); i++)
        {
            let survivor = People[i];
            if (i > 0) humanPositions = humanPositions .. ",";
            humanPositions = humanPositions .. String.Format("{\"id\":%d,\"alive\":%d,\"safe\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f}", i, survivor.Alive, survivor.Safe,
                survivor.Body ? survivor.Body.Pos.X : 0, survivor.Body ? survivor.Body.Pos.Y : 0, survivor.Body ? survivor.Body.Pos.Z : 0);
            if (survivor.Alive && survivor.Body && (KindAt(survivor.Body.Pos.XY) == 2 || KindAt(survivor.Body.Pos.XY) == 7)) outsidePeople++;
        }
        humanPositions = humanPositions .. "]";
        let props = ThinkerIterator.Create('PDCamera'); PDCamera camera;
        while ((camera = PDCamera(props.Next())) != null) if (!camera.Used) cameras++;
        Console.Printf("PDOOM_STATE {\"ticks\":%d,\"health\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.1f,\"controlled\":%d,\"saved\":%d,\"alive\":%d,\"remaining\":%d,\"ammo\":%d,\"gun\":%d,\"charge\":%d,\"hold\":%d,\"awake\":%d,\"door\":%d,\"breach\":%d,\"relay\":%d,\"cart\":%d,\"cameras\":%d,\"fuse\":%d,\"ended\":%d,\"outside\":%d,\"outside_people\":%d,\"humans\":%s,\"hunter_x\":%.1f,\"hunter_y\":%.1f,\"hunter_state\":%d,\"hunter_aim\":%d,\"prompt\":\"%s\",\"message\":\"%s\"}",
            level.time, person.Alive ? pawn.health : 0, pawn.Pos.X, pawn.Pos.Y, pawn.Pos.Z, pawn.Angle, Controlled, SavedCount(), AliveCount(), RemainingCount(), person.Ammo, person.Gun, person.Charge, Holding, Awake, DoorOpen, BreachOpen, RelayOpen, CartMoved, cameras, max(0, FuseUntil - level.time), Ended, KindAt(pawn.Pos.XY) == 2 || KindAt(pawn.Pos.XY) == 7, outsidePeople, humanPositions,
            Hunter ? Hunter.Pos.X : 0, Hunter ? Hunter.Pos.Y : 0, Hunter ? Hunter.Mood : 0, Hunter ? Hunter.AimTics : 0, prompt, message);
    }
    override void WorldTick()
    {
        if (!Initialized || !players[0].mo) return;
        if (!Ended)
        {
            let pawn = players[0].mo;
            int buttons = pawn.player.cmd.buttons;
            if ((buttons & BT_USE) && !(OldButtons & BT_USE)) UseProp();
            if ((buttons & BT_ATTACK) && !(OldButtons & BT_ATTACK)) Attack();
            if ((buttons & BT_USER1) && !(OldButtons & BT_USER1)) ToggleOrder();
            if ((buttons & BT_USER2) && !(OldButtons & BT_USER2)) GiveGun();
            OldButtons = buttons;
            if (!Awake && KindAt(pawn.Pos.XY) != 3) Alert(pawn.Pos.XY);
            TickFuse(); TickPeople(); SeparatePeople(); TickHunter();
        }
        if (level.time % 7 == 0) Report();
    }
}
