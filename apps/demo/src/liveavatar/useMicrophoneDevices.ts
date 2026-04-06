import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceChat } from "./useVoiceChat";

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export function useMicrophoneDevices() {
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const { setDevice } = useVoiceChat();
  const mountedRef = useRef(true);
  const selectRequestRef = useRef(0);

  const selectedDeviceIdRef = useRef(selectedDeviceId);
  selectedDeviceIdRef.current = selectedDeviceId;

  const enumerate = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const mics = allDevices
        .filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 4)}`,
        }));

      if (!mountedRef.current) return;

      setDevices(mics);

      const prev = selectedDeviceIdRef.current;
      let nextDeviceId: string | null = null;

      if (!prev) {
        nextDeviceId = mics[0]?.deviceId ?? null;
      } else if (!mics.some((m) => m.deviceId === prev)) {
        nextDeviceId = mics[0]?.deviceId ?? null;
      }

      if (nextDeviceId && nextDeviceId !== prev) {
        setSelectedDeviceId(nextDeviceId);
        await setDevice({ exact: nextDeviceId });
      }
    } catch {
      // enumerateDevices failed — leave devices empty
    }
  }, [setDevice]);

  useEffect(() => {
    mountedRef.current = true;
    enumerate();

    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      mountedRef.current = false;
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    };
  }, [enumerate]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      const requestId = ++selectRequestRef.current;
      const result = await setDevice({ exact: deviceId });
      if (
        result &&
        mountedRef.current &&
        selectRequestRef.current === requestId
      ) {
        setSelectedDeviceId(deviceId);
      }
    },
    [setDevice],
  );

  return { devices, selectedDeviceId, selectDevice };
}
