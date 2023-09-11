// sharedState.ts

import { useState } from 'react';

const usePeerConnectionMap = () => {
  const [peerConnectionMap, setPeerConnectionMap] = useState<Map<string, RTCPeerConnection>>(new Map());

  const addNewPeerConnection = (peerId: string, connection: RTCPeerConnection) => {
    const newMap = new Map(peerConnectionMap);
    newMap.set(peerId, connection);
    setPeerConnectionMap(newMap);
  }

  return { peerConnectionMap, addNewPeerConnection };
};

export { usePeerConnectionMap };