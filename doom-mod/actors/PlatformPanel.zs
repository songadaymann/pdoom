// The browser panel owns a silent native menu. Existing native menus/pauses are
// left alone. No UI printf: that would suspend inside this port's render callback.
class PDPlatformPauseMenu : Menu
{
    override void Drawer() {}
    override bool OnUIEvent(UiEvent e)
    {
        if (e.Type == UiEvent.Type_KeyDown && e.KeyChar == UiEvent.Key_F11)
        {
            let owner = PDPlatformPanel(EventHandler.Find('PDPlatformPanel'));
            if (owner) owner.ClosePanel();
            return true;
        }
        return Super.OnUIEvent(e);
    }
}

class PDPlatformPanel : EventHandler
{
    ui PDPlatformPauseMenu OwnedMenu;

    override void OnRegister() { IsUiProcessor = false; }

    ui void OpenPanel()
    {
        if (OwnedMenu || Menu.GetCurrentMenu() || paused) return;
        OwnedMenu = new('PDPlatformPauseMenu'); OwnedMenu.Init(null);
        OwnedMenu.DontDim = true; OwnedMenu.DontBlur = true;
        OwnedMenu.ActivateMenu();
    }

    ui void ClosePanel()
    {
        if (!OwnedMenu) return;
        if (Menu.GetCurrentMenu() == OwnedMenu) OwnedMenu.Close();
        OwnedMenu = null;
    }

    override bool InputProcess(InputEvent e)
    {
        if (e.Type != InputEvent.Type_KeyDown) return false;
        if (e.KeyScan == InputEvent.Key_F10) { OpenPanel(); return true; }
        if (e.KeyScan == InputEvent.Key_F11) { ClosePanel(); return true; }
        return false;
    }

}
