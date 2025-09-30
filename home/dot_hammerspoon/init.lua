-- EmmyLua generates completion files in "/Users/$USER/.hammerspoon/Spoons/EmmyLua.spoon/annotations"
hs.loadSpoon("EmmyLua")
hs.loadSpoon("ReloadConfiguration")

spoon.ReloadConfiguration:start()
hs.alert.show("Hammerspoon config reloaded! Watching ~/.hammerspoon/init.lua")

-- Hello World
hs.hotkey.bind({ "alt", "shift" }, "W", function()
  hs.alert.show("Hello World!")
end)


hs.hotkey.bind({ "alt", "shift" }, "R", function()
  local result = hs.execute('aerospace reload-config', true)
  hs.alert.show("Aerospace config reloaded!")
end)
