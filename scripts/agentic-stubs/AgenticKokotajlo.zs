// STUB (core, docs/LEVEL-04.md): Daniel Kokotajlo's rescue, Race or Slowdown (crusher corridor, harvest bay 29, the NDA panels).
// Kept in scripts/agentic-stubs/ too: build-agentic-preview.py --only swaps the other four rescues
// back to these stubs. The rescue's engineer replaces this file; the hooks are PDAgenticPuzzle's (Agentic.zs).
class PDAgenticKokotajlo : PDAgenticPuzzle
{
    override void Setup() {}
    override void Tick(PlayerPawn pawn) {}
    override String Prompt(PlayerPawn pawn) {return "";}
    override bool Use(PlayerPawn pawn) {return false;}
    override bool Swing(PlayerPawn pawn) {return false;}
    override bool SmithBusy() {return false;}
    override bool HoldsPlayer() {return false;}
    override void ApplySite(int site) {}
    override void Released() {}
    override String Json() {return "";}
}
