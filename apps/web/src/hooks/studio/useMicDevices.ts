'use client';

import { useCallback, useEffect, useState } from 'react';

export interface MicDevice {
  deviceId: string;
  label: string;
}

export interface UseMicDevicesReturn {
  /** Available audio inputs. Empty until the browser exposes any. */
  devices: MicDevice[];
  /** undefined = system default. */
  selectedDeviceId: string | undefined;
  selectDevice: (deviceId: string | undefined) => void;
  /** Re-enumerate — call after mic permission is granted so labels populate. */
  refresh: () => Promise<void>;
}

function toMicDevice(device: MediaDeviceInfo, index: number): MicDevice {
  return {
    deviceId: device.deviceId,
    // Labels are empty before mic permission is granted.
    label: device.label || `Microphone ${index + 1}`,
  };
}

/**
 * Live list of audio input devices. Listens to `devicechange` so plugging in
 * an external mic (USB/Bluetooth) shows up without a reload; if the selected
 * device is unplugged, selection falls back to system default.
 */
export function useMicDevices(): UseMicDevicesReturn {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        all
          .filter((d) => d.kind === 'audioinput' && d.deviceId !== '')
          .map(toMicDevice)
      );
    } catch {
      // Enumeration can fail in locked-down contexts; keep whatever we had.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!media?.addEventListener) return;
    const onChange = () => void refresh();
    media.addEventListener('devicechange', onChange);
    return () => media.removeEventListener('devicechange', onChange);
  }, [refresh]);

  // Selected mic unplugged → back to system default.
  useEffect(() => {
    if (
      selectedDeviceId !== undefined &&
      devices.length > 0 &&
      !devices.some((d) => d.deviceId === selectedDeviceId)
    ) {
      setSelectedDeviceId(undefined);
    }
  }, [devices, selectedDeviceId]);

  return { devices, selectedDeviceId, selectDevice: setSelectedDeviceId, refresh };
}
