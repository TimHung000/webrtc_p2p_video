'use client'
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client"
import { Webrtc } from "@/components/webrtc/webrtc";
import MediaSelector from "./mediaSelector"
import { useSearchParams, useRouter, redirect } from 'next/navigation'


const Home = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomId = searchParams.get('roomId');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const videoGridRef = useRef<HTMLDivElement>(null);
    // const notificationRef = useRef<HTMLParagraphElement>(null);
    const webrtc = useRef<Webrtc | null>(null);
    const [users, setUsers] = useState<{ socketId: string, stream: MediaStream }[]>([]);
    const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDevice, setSelectedVideoDevice] = useState<MediaDeviceInfo | null>(null);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState<MediaDeviceInfo | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    
    // const notify = (message: string) => {
    //     if (notificationRef.current) {
    //         notificationRef.current.innerHTML = message;
    //     }
    // };

    // const handleError = (e: any) => {
    //     const error = e.detail.error;
    //     console.error(error);
    //     notify(error);
    // };

    // const handleNotification = (e: any) => {
    //     const notif = e.detail.notification;
    //     console.log(notif);
    //     notify(notif);
    // };

    // Function to toggle audio state
    const toggleAudio = () => {
        setIsAudioEnabled(!isAudioEnabled);
        webrtc.current?.handleToggleAudio();
    };

    // Function to toggle video state
    const toggleVideo = () => {
        setIsVideoEnabled(!isVideoEnabled);
        webrtc.current?.handleToggleVideo();
    };

    const handleLeaveBtnClick = () => {
        webrtc.current?.leaveRoom();
    };

    const handleLocalStream = (stream: MediaStream) => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
    };

    const handleUserLeave = (e: any) => {
        console.log(`user ${e.detail.socketId} left room`);
        setUsers((prevUsers) => prevUsers.filter((user) => user.socketId !== e.detail.socketId));
    };

    const handleLeftRoom = (e: any) => {
        console.log(`I left the room ${e.detail.roomId}`);
        router.push('/');
    };

    const handleNewUser = (e: any) => {
        console.log('new user')
        const socketId = e.detail.socketId;
        const stream = e.detail.stream;
        setUsers((prevUsers) => [...prevUsers, { socketId, stream }]);
    };

    useEffect(() => {
        const socket = io('http://localhost:5000');
        webrtc.current = new Webrtc(socket);

        webrtc.current.addEventListener('leftRoom', handleLeftRoom)
        webrtc.current.addEventListener('userLeave', handleUserLeave);
        webrtc.current.addEventListener('newUser', handleNewUser);
        // webrtc.current.addEventListener('error', handleError);
        // webrtc.current.addEventListener('notification', handleNotification);

        navigator.mediaDevices.enumerateDevices().then((value: MediaDeviceInfo[]) => {
            const audios = value.filter(device => device.kind === 'audioinput');
            const videos = value.filter(device => device.kind === 'videoinput');
            setAudioInputs(audios);
            setVideoInputs(videos);
            setSelectedAudioDevice(audios[0]);
            setSelectedVideoDevice(videos[0]);
            const constraints = {
                video: selectedVideoDevice ? { deviceId: selectedVideoDevice.deviceId } : true,
                audio: selectedAudioDevice ? { deviceId: selectedAudioDevice.deviceId } : true,
            };
            webrtc.current?.getLocalStream(constraints).then((stream) => {
                handleLocalStream(stream as MediaStream);
                if(roomId) {
                    webrtc.current?.joinRoom(roomId);
                }
            }).catch((error) => {
                console.error(error);
            })
        })
        return () => {
            webrtc.current?.leaveRoom();
        };
    }, []);

    return (
        <div>
            <h1></h1>
            <MediaSelector
                label="Video"
                devices={videoInputs}
                selectedDevice={selectedVideoDevice}
                onChange={setSelectedVideoDevice}
            />
            <MediaSelector
                label="Audio"
                devices={audioInputs}
                selectedDevice={selectedAudioDevice}
                onChange={setSelectedAudioDevice}
            />
            <button id="leaveBtn" onClick={handleLeaveBtnClick}>
                stop call
            </button>

            <button id="toggleAudioBtn" onClick={toggleAudio}>
                {isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
            </button>

            <button id="toggleVideoBtn" onClick={toggleVideo}>
                {isVideoEnabled ? "Turn Off Video" : "Turn On Video"}
            </button>

            {/* <p id="notification" ref={notificationRef}></p> */}
            <div id="localVideo-container">
                <video ref={localVideoRef} autoPlay playsInline></video>
            </div>
            <div id="videos">
                <div id="videoGrid" className="grid-container" ref={videoGridRef}>
                    {users.map((user) => (
                        <div key={user.socketId} className="grid-item" id={user.socketId}>
                            <p>{user.socketId}</p>
                            <RemoteVideo stream={user.stream} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const RemoteVideo = ({ stream }: {stream: MediaStream}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        } 
    }, [stream, videoRef]);

    return (
        <video ref={videoRef} autoPlay playsInline />
    );
}

export default Home;
