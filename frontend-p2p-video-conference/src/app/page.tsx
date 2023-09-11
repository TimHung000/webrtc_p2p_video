'use client'
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const Home = () => {
    const router = useRouter();
    const [roomId, setRoomId] = useState('');
    const [showWarning, setShowWarning] = useState(false);

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const roomId = formData.get('roomId');
        if(roomId) {
            router.push(`/concall?roomId=${roomId}`);
        } else {
            setShowWarning(true)
        }

    };

    return (
        <div>
            {showWarning && (
                <aside className="warning">
                <p>Invalid roomId</p>
                </aside>
            )}
            <form onSubmit={handleJoin}>
                <input type="text" name="roomId" placeholder="room id" 
                    value={roomId} 
                    onChange={(e) => {
                        setRoomId(e.target.value);
                        setShowWarning(false); // Hide warning when input changes
                    }}
                />
                <button type="submit">Join</button>
            </form>
        </div>
    );
};

export default Home;
