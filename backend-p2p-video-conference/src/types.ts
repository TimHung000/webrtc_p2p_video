type RTCSdpType = "answer" | "offer" | "pranswer" | "rollback";

export interface RTCSessionDescriptionInit {
    sdp?: string;
    type: RTCSdpType;
}

export interface RTCIceCandidateInit {
    candidate?: string;
    sdpMLineIndex?: number | null;
    sdpMid?: string | null;
    usernameFragment?: string | null;
}