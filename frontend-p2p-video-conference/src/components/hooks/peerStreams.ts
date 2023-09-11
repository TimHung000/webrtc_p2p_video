import { useState } from 'react';

const useStreamMap = () => {
  const [streamMap, setStreamMap] = useState<Map<string, MediaStream>>(new Map());

  const addNewPeerStream = (peerId: string, stream: MediaStream) => {
    const newMap = new Map(streamMap);
    newMap.set(peerId, stream);
    setStreamMap(newMap)
  }

  return { streamMap, addNewPeerStream };
};

export { useStreamMap };