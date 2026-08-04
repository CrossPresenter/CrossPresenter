import { useEffect, useState } from "react";
import { PresenterView, type PresenterState } from "./components/PresenterView";

export function Presenter() {
  const [state, setState] = useState<PresenterState>({
    text: "",
    isBlank: false,
    isTheme: false,
    isLive: false,
    activeCameraId: null,
    backgroundImage: null,
  });

  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.onStateUpdate) {
      // @ts-ignore
      window.electron.onStateUpdate((newState: PresenterState) => {
        setState(newState);
      });
    }
  }, []);

  return <PresenterView state={state} isPreview={false} />;
}
