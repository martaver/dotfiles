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
  hs.execute('launchctl kickstart -k "gui/${UID}/homebrew.mxcl.yabai"')
  hs.alert.show("Yabai config reloaded!")
end)
