// Exact active-world clock and final result owner. Menus do not WorldTick.
class PDRescueRun : Object play
{
    int ActiveTics;
    int CoverDoom;
    bool Practice;
    bool Finished;

    void Load()
    {
        ActiveTics = 0; CoverDoom = -1; Finished = false;
        Practice = players[0].mo.GetCVar("pdoom_dev_end") != 0 || PDCampaignSession.Get().HubEntry;
        Console.Printf("PDOOM_RUN_START {\"level_id\":\"%s\",\"level_version\":\"%s\",\"practice\":%d}", PDCampaignSession.Id(),PDCampaignSession.MapVersion(),Practice);
    }

    void Tick()
    {
        if (Finished) return;
        ActiveTics++;
        int cheats = players[0].cheats;
        if (cheats & (CF_NOCLIP | CF_NOCLIP2 | CF_GODMODE | CF_GODMODE2 | CF_BUDDHA | CF_BUDDHA2 | CF_FLY | CF_NOTARGET | CF_FRIGHTENING | CF_NOVELOCITY)) Practice = true;
    }

    void SnapshotCover(PDCheckpoint game)
    {
        if (CoverDoom >= 0) return;
        int found = 0, freed = 0, sheltered = 0;
        double companionInjury = 0;
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (!p.Alive) continue;
            if (p.Discovered) found++;
            if (p.Released) freed++;
            if (p.Sheltered || p.Taken && PDRescueRefuge.Inside(players[0].mo.Pos.XY)) sheltered++;
            if (p.Released && !p.Taken && p.Body) companionInjury += max(0, 100 - p.Body.health) * 0.025;
        }
        double outlook = 12 + found * 2 + freed * 8 + sheltered * 6 + (game.Refuge.Known ? 4 : 0)
            + (game.GroupGathered ? 2 : 0) + 1 - (6 - game.Cast.AliveCount()) * 5
            - max(0, 100 - max(0, players[0].mo.health)) * 0.12 - companionInjury;
        CoverDoom = 100 - int(floor(clamp(outlook, 1, 99) + 0.5));
    }

    void Report()
    {
        Console.Printf("PDOOM_RUN {\"level_id\":\"%s\",\"level_version\":\"%s\",\"active_tics\":%d,\"p_doom_cover\":%d,\"practice\":%d}", PDCampaignSession.Id(),PDCampaignSession.MapVersion(),ActiveTics,CoverDoom,Practice);
    }

    void Finish(PDCheckpoint game, int saved)
    {
        if (Finished) return;
        Finished = true;
        int figures=0;
        for(int i=0;i<5;i++)if(game.Cast.People[i].Alive&&game.Cast.People[i].Released&&(game.Escape.Saved[i]||game.Cast.People[i].Taken&&saved>0))figures++;
        String ceo=game.CeoDown?(saved>0?"carried":"downed"):"conscious";
        int scoreSaved=saved>0?figures+(game.CeoDown?0:1):0;
        if(saved>0)PDCampaignSession.Get().Commit(game);
        String routes = "[";
        for (int i = 0; i < game.Cast.People.Size(); i++)
            routes = routes .. String.Format("%s\"%s\"", i == 0 ? "" : ",", game.Cast.People[i].Route);
        routes = routes .. "]";
        Console.Printf("PDOOM_RESULT {\"outcome\":\"%s\",\"saved\":%d,\"total\":6,\"level_id\":\"%s\",\"level_version\":\"%s\",\"score_version\":\"rescue-v2\",\"active_tics\":%d,\"p_doom_cover\":%d,\"cameras_broken\":%d,\"cameras_total\":%d,\"practice\":%d,\"routes\":%s,\"saved_figures\":%d,\"ceo_state\":\"%s\",\"skill\":3,\"entry\":\"%s\",\"retreat\":%d}",
            saved > 0 ? "escaped" : "lost", scoreSaved,PDCampaignSession.Id(),PDCampaignSession.MapVersion(), ActiveTics, CoverDoom, game.Combat.BrokenCount(), game.Combat.Cameras.Size(), Practice, routes,figures,ceo,game.Replay?"replay":game.EntryHub?"hub":"cold",game.Retreat);
    }
}
