// import SocketClient from "@/components/websocket/socket";
import { Socket } from "socket.io-client";

const _peerConnectionConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
    ],
  };

class Webrtc extends EventTarget {
    private _myId: string | null;
    private _roomId: string | null;
    private _localStream: MediaStream | null;
    private socket: Socket;
    private peerConnectionConfig: RTCConfiguration | undefined;
    private peerConnections: Record<string, RTCPeerConnection>;
    private streams: Record<string, MediaStream>;
    private log: (...data: any[]) => void;
    private warn: (...data: any[]) => void;
    private error: (...data: any[]) => void;

    constructor(socket: Socket, peerConnectionConfig: RTCConfiguration | undefined = _peerConnectionConfig, logging = { log: true, warn: true, error: true }) {
        super();
        this._myId = null;
        this._roomId = null;
        this._localStream = null;
        this.socket = socket;
        this.peerConnectionConfig = peerConnectionConfig;
        this.peerConnections = {};
        this.streams = {};

        // Manage logging
        this.log = logging.log ? console.log : () => {};
        this.warn = logging.warn ? console.warn : () => {};
        this.error = logging.error ? console.error : () => {};

        // Initialize socket.io listeners
        this._onSocketListeners();
    }

    get localStream() {
        return this._localStream;
    }

    get myId() {
        return this._myId;
    }

    get roomId() {
        return this._roomId;
    }

    get participants() {
        return Object.keys(this.peerConnections);
    }

    public joinRoom(roomId: string) {
        if (!roomId) {
            this.warn('Room Id not provided');
            // this._emit('notification', { notification: `Room Id not provided` });
            return;
        }
        this.socket.emit('joinRoom', roomId);
    }

    public leaveRoom() {
        if (!this._roomId) {
            this.warn('You are currently not in a room');
            return;
        }
        this.socket.emit('leaveRoom', this._roomId);
    }

    public handleToggleVideo() {
        const videoTracks = this.localStream?.getVideoTracks();
        if (videoTracks && videoTracks.length > 0) {
            videoTracks[0].enabled = !videoTracks[0].enabled;
        } else {
            console.error("No video tracks found.");
        }
    }
    
    public handleToggleAudio() {
        const audioTracks = this.localStream?.getAudioTracks();
        if (audioTracks && audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
        } else {
            console.error("No video tracks found.");
        }
    }

    public getLocalStream(constraints: MediaStreamConstraints) {
        return navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                this.log('Got local stream.');
                this._localStream = stream;
                return stream;
            })
            .catch((error) => {
                this.error(`Can't get usermedia ${error.toString()}`);
                // this._emit('error', { error: new Error(`Can't get usermedia ${error.toString()}`) });
            });
    }

    private _onSocketListeners() {
        this.log('socket listeners initialized');
        this.socket.on("connect", () => {
            this.log(`${this.socket.id} connected`);
        })

        this.socket.on('roomCreated', (roomId, socketId) => {
            this.log(`I ${socketId} successfully create a room ${roomId}`);
            this._roomId = roomId;
            this._myId = socketId;
            // this._emit('roomCreated', { roomId: roomId });
        });

        this.socket.on('joined', (roomId, socketId) => {
            this.log(`I ${socketId} successfully join the room ${roomId}`);
            this._roomId = roomId;
            this._myId = socketId;
            // this._emit('joinedRoom', { roomId: roomId });
            this._sendMessage({ type: 'webrtcConnect' }, null, this._roomId);
        });

        // Left the room
        this.socket.on('leftRoom', (roomId) => {
            if (roomId === this._roomId) {
                this.log(`Left the room ${roomId}`);
                this._roomId = null;
                this._removeUserFromPeerConnections();
                if(this._localStream) {
                    this._localStream.getTracks().forEach((track) => {
                        track.stop();
                    })
                }
                this._emit('leftRoom', { roomId: roomId });
            }
        });

        // Someone joins room
        this.socket.on('join', (roomId, socketId) => {
            this.log(`Incoming request from ${socketId} join room ${roomId}`);
            // this._emit('newUser', { socketId });
            // this.dispatchEvent(new Event('newJoin'));
        });

        // Logs from server
        this.socket.on('log', (log) => {
            this.log.apply(console, log);
        });

        /**
         * Message from the server
         * Manage stream and sdp exchange between peers
         */
        this.socket.on('message', (message, socketId) => {
            this.log('From', socketId, ' received:', message.type);

            // Participant leaves
            if (message.type === 'leave') {
                this.log(`${socketId} left the call.`);
                this._removeUserFromPeerConnections(socketId);
                this._emit('userLeave', { socketId: socketId });
                return;
            }

            // Avoid duplicate connections
            if ( this.peerConnections[socketId] && this.peerConnections[socketId].connectionState === 'connected') {
                this.log(`Connection with ${socketId} is already established`);
                return;
            }

            switch (message.type) {
                case 'webrtcConnect': // user is ready to share their stream
                    this._connect(socketId);
                    this.log('Creating offer for ', socketId);
                    this._Offer(socketId);
                    break;
                case 'offer': // got connection offer
                    if (!this.peerConnections[socketId]) {
                        this._connect(socketId);
                    }
                    this.peerConnections[socketId].setRemoteDescription(
                        new RTCSessionDescription(message)
                    );
                    this._answer(socketId);
                    break;
                case 'answer': // got answer for sent offer
                    this.peerConnections[socketId].setRemoteDescription(
                        new RTCSessionDescription(message)
                    );
                    break;
                case 'candidate': // received candidate sdp
                    const candidate = new RTCIceCandidate({
                        sdpMLineIndex: message.label,
                        candidate: message.candidate,
                    });
                    this.peerConnections[socketId].addIceCandidate(candidate);
                    break;
            }
        });
    }

    private _connect(socketId: string) {
        if (typeof this._localStream !== 'undefined') {
            this.log('Create peer connection to ', socketId);
            this._createPeerConnection(socketId);
            if(this._localStream) {
                this._localStream.getTracks().forEach(track => {
                    this.peerConnections[socketId].addTrack(track, this._localStream!);
                });
            } else {
                console.warn(`no localstream ${this._localStream}`)
            }
        } else {
            this.warn(`Failed to connect to socketId ${socketId}`);
        }
    }

    private _createPeerConnection(socketId: string) {
        if (this.peerConnections[socketId]) {
            this.warn('Connection with ', socketId, ' already established');
            return;
        }
        this.peerConnections[socketId] = new RTCPeerConnection(this.peerConnectionConfig);
        this.peerConnections[socketId].onicecandidate = this._handleIceCandidate.bind(this, socketId);
        this.peerConnections[socketId].ontrack = this._handleOnTrack.bind(this, socketId);
        this.log('Created RTCPeerConnnection for ', socketId);
    }

    // public handleStreamChanged() {
    //     let videoTrack : MediaStreamTrack;
    //     let audioTrack : MediaStreamTrack;
    //     if(this._localStream) {
    //         [videoTrack] = this._localStream.getVideoTracks();
    //         [audioTrack] = this._localStream.getAudioTracks();

    //         Object.entries(this.peerConnections).forEach(([socketId, peerConnection]) => {
    //             const videoSender = peerConnection.getSenders().find((s) => s.track?.kind === videoTrack.kind);
    //             if(videoSender) {
    //                 videoSender.replaceTrack(videoTrack);
    //             } else {
    //                 peerConnection.addTrack(videoTrack, this._localStream!);
    //             }
    //             const audioSender = peerConnection.getSenders().find((s) => s.track?.kind === audioTrack.kind);
    //             if(audioSender) {
    //                 audioSender.replaceTrack(audioTrack);
    //             } else {
    //                 peerConnection.addTrack(videoTrack, this._localStream!);
    //             }
    //         })
    //     }
    // }

    private _handleIceCandidate(socketId: string, event: RTCPeerConnectionIceEvent) {
        this.log('icecandidate event');
        if (event.candidate) {
            this._sendMessage(
                {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                },
                socketId
            );
        }
    }

    private _handleOnTrack(socketId: string, event: RTCTrackEvent) {
        this.log('Remote stream added for ', socketId);
        if (this.streams[socketId]?.id !== event.streams[0].id) {
            this.streams[socketId] = event.streams[0];

            this._emit('newUser', {
                socketId,
                stream: event.streams[0],
            });
        }
    }

    private _Offer(socketId: string) {
        this.log('Sending offer to ', socketId);
        this.peerConnections[socketId].createOffer().then((offer) => {
            this.peerConnections[socketId].setLocalDescription(offer);
            this._sendMessage(offer, socketId);
        }).catch((error) => {
            this.error(`ERROR creating offer ${error.toString()}`);
            // this._emit('error', {
            //     error: new Error(`Error while creating an offer: ${error.toString()}`),
            // });
        })
    }

    private _answer(socketId: string) {
        this.log('Sending answer to ', socketId);
        this.peerConnections[socketId].createAnswer().then((answer) => {
            this.peerConnections[socketId].setLocalDescription(answer);
            this._sendMessage(answer, socketId);
        }).catch((error) => {
            this.log(`Error creating answer: ${error.toString()}`);
            this._emit('error', {
                error: new Error(`Error while creating an answer: ${error.toString()}`),
            });
        })
    }

    private _removeUserFromPeerConnections(socketId: string | null = null) {
        if (!socketId) {
            // close all connections
            for (const [key, value] of Object.entries(this.peerConnections)) {
                this.log('closing', value);
                value.close();
                delete this.peerConnections[key];
            }
            this.streams = {};

        } else {
            if (!this.peerConnections[socketId]) return;
            this.peerConnections[socketId].close();
            delete this.peerConnections[socketId];
            delete this.streams[socketId];
        }

    }

    private _sendMessage(message: any, toId: string | null = null, roomId: string | null = null) {
        this.socket.emit('message', message, toId, roomId);
    }

    // Custom event emitter
    private _emit(eventName: string, details: any) {
        this.dispatchEvent(
            new CustomEvent(eventName, {
                detail: details,
            })
        );
    }
}

// export default WebRTC;
export { Webrtc };
