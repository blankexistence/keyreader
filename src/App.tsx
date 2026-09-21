import { useEffect, useLayoutEffect, useState, useRef } from "react"
import { listen } from "@tauri-apps/api/event"
import { appWindow } from "@tauri-apps/api/window"
import Key from "./Key"
import { controlKeyCodes, specialKeysObj } from "./config"

let controlPressed = false
const controlKeys = ["ControlLeft", "ControlRight"]
const shiftKeys = ["ShiftLeft", "ShiftRight"]
const metaKeys = ["MetaLeft", "MetaRight"]
const altKeys = ["Alt", "AltGr"]

// Hard cap so the history can't grow forever; the real limit is measured (see useLayoutEffect)
const MAX_KEYS = 50

function App() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const viewportRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [alphabeticKeys, setAlphabeticKeys] = useState<string[]>(["NONE"])
  const [modifierKeys, setModifierKeys] = useState([
    {
      title: specialKeysObj.ShiftLeft,
      id: shiftKeys,
      active: false,
    },
    {
      title: specialKeysObj.ControlLeft,
      id: controlKeys,
      active: false,
    },
    { title: specialKeysObj.Alt, id: altKeys, active: false },
    {
      title: specialKeysObj.MetaLeft,
      id: metaKeys,
      active: false,
    },
  ])

  const needTobeCleared = (message: string) =>
    [
      specialKeysObj.ControlLeft,
      specialKeysObj.ControlRight,
      specialKeysObj.MetaLeft,
      specialKeysObj.MetaRight,
      specialKeysObj.Alt,
      specialKeysObj.AltGr,
      specialKeysObj.Esc,
    ].includes(message)

  const updateTickers = (message: string) => {

    setAlphabeticKeys((prevTickers) => {
      const charCode = message.charCodeAt(0)

      if (charCode === 9) {
        message = specialKeysObj.Tab
      }

      if (charCode === 13) {
        message = specialKeysObj.Enter
      }

      if (charCode === 27) {
        message = specialKeysObj.Esc
      }

      // Ctrl+Backspace makes Windows report DEL (0x7F) instead of BS (0x08)
      if (charCode === 8 || charCode === 127) {
        message = specialKeysObj.Backspace
      }

      if (charCode === 32) {
        message = specialKeysObj.Space
      }

      if (controlKeyCodes[charCode] && controlPressed) {
        message = controlKeyCodes[charCode]
      }

      if (message in specialKeysObj) {
        message = specialKeysObj[message]
      }

      let newTickers = []
      if (needTobeCleared(message)) {
        newTickers = [message]
      } else {
        newTickers = [...prevTickers, ...[message]]
      }

      return newTickers.slice(-MAX_KEYS)
    })
  }

  const updateModifierActiveStatus = (message: string, status: boolean) => {
    setModifierKeys((modifierKeys) => {
      return modifierKeys.map((keycap) => {
        const cloned = { ...keycap }
        if (cloned.id.includes(message)) {
          cloned.active = status
        }
        return cloned
      })
    })
  }

  const updateControlPressedStatus = (message: string, status: boolean) => {
    if (controlKeys.includes(message)) controlPressed = status
  }

  const closeWindow = () => {
    appWindow.close()
  }

  useEffect(() => {
    const unlisten = listen("keypress", ({ payload }) => {
      const { mode, message } = payload as { message: string; mode: string }

      if (mode === "Some") {
        updateTickers(message)
        updateModifierActiveStatus(message, true)
      }

      if (mode === "KeyPress") {
        updateControlPressedStatus(message, true)
        updateTickers(message)
        updateModifierActiveStatus(message, true)
      }

      if (mode === "KeyRelease") {
        updateControlPressedStatus(message, false)
        updateModifierActiveStatus(message, false)
      }
    })

    return () => {
      unlisten.then((stop) => stop())
    }
  }, [])

  // Drop the oldest key until the row actually fits inside the box.
  // Runs before paint, so the overflow is never visible.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const row = rowRef.current
    if (!viewport || !row) return

    if (row.offsetWidth > viewport.clientWidth && alphabeticKeys.length > 1) {
      setAlphabeticKeys((keys) => keys.slice(1))
    }
  }, [alphabeticKeys, windowWidth])

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div data-tauri-drag-region className="ticker-container group">
        <button onClick={closeWindow} className="btn-close group-hover:opacity-100">
          ✕
        </button>
        <div className={`tickers ${ windowWidth > 310 ? 'rounded-bl-3xl': '' }`}>
          <div ref={viewportRef} className="ticker-viewport">
            <div ref={rowRef} className="ticker-row">
              {alphabeticKeys.map((ticker, idx) => {
                return <Key key={idx} ticker={ticker} />
              })}
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <div className="modifier-keycaps w-[300px] max-w-[300px]">
            {modifierKeys.map((keycap, index) => {
              const active = keycap.active
              return (
                <div key={index} className={`keycap main-background`}>
                  <span className={active ? "" : "opacity-50"}>{keycap.title}</span>
                </div>
              )
            })}
          </div>
        </div>
    </div>
  )
}

export default App
