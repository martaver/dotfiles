-- EmmyLua generates completion files in "/Users/$USER/.hammerspoon/Spoons/EmmyLua.spoon/annotations"
hs.loadSpoon("EmmyLua")
hs.loadSpoon("ReloadConfiguration")

spoon.ReloadConfiguration:start()
-- hs.alert.show("Hammerspoon config loaded! Watching ~/.hammerspoon/init.lua")

-- Hello World
hs.hotkey.bind({ "cmd", "alt", "ctrl" }, "W", function()
  hs.alert.show("Hello Worldly!")
end)
