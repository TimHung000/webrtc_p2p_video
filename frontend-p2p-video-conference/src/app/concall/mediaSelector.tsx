import React from "react";

interface MediaSelectorProps {
  label: string;
  devices: MediaDeviceInfo[];
  selectedDevice: MediaDeviceInfo | null;
  onChange: (device: MediaDeviceInfo | null) => void;
}

const MediaSelector: React.FC<MediaSelectorProps> = ({ label, devices, selectedDevice, onChange }) => (
  <div style={{display: 'none'}}>
    <label htmlFor={`${label}Devices`}>Select {label} Device:</label>
    <select
      id={`${label}Devices`}
      value={selectedDevice?.deviceId || ""}
      onChange={(e) => {
        const selectedDeviceId = e.target.value;
        const device = devices.find(device => device.deviceId === selectedDeviceId) || null;
        onChange(device);
      }}
    >
      {devices.map(device => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.label}
        </option>
      ))}
    </select>
  </div>
);

export default MediaSelector;