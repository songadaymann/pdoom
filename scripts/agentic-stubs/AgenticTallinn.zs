// STUB (core, docs/LEVEL-04.md): Jaan Tallinn's rescue, Run the hardline (payphone booth 19, cable drum in hall 31).
// Kept in scripts/agentic-stubs/ too: build-agentic-preview.py --only swaps the other four rescues
// back to these stubs. The rescue's engineer replaces this file; the hooks are PDAgenticPuzzle's (Agentic.zs).
class PDAgenticTallinn : PDAgenticPuzzle
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
