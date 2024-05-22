// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import socket from './socket';
import axios from 'axios';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedSongs, setUploadedSongs] = useState([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const socketRef = useRef(socket);
  const audioSourceRef = useRef(null);

  useEffect(() => {
    async function getMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (isStreaming) {
            const audioData = e.inputBuffer.getChannelData(0);
            socketRef.current.emit('audio', audioData.buffer);
          }
        };

        audioSourceRef.current = { source, processor };
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    }

    getMicrophone();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isStreaming]);

  useEffect(() => {
    socketRef.current.on('mp3', (data) => {
      const songUrl = `http://localhost:4000/uploads/${data.filename}`;
      setUploadedSongs((prevSongs) => [...prevSongs, songUrl]);
    });

    return () => {
      socketRef.current.off('mp3');
    };
  }, []);

  const handleStreamingToggle = () => {
    setIsStreaming(!isStreaming);
  };

  const handleMp3Upload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('socketId', socketRef.current.id); // Send the socketId with the upload

      try {
        await axios.post('http://localhost:4000/upload', formData);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const playAllSongs = () => {
    uploadedSongs.forEach((song, index) => {
      setTimeout(() => {
        const audio = new Audio(song);
        audio.play().catch((error) => {
          console.error(`Failed to play audio file ${song}:`, error);
        });
      }, index * 3000); // Adjust the delay as needed for song length
    });
  };

  return (
    <div className="App">
      <h1>Microphone Audio Sharing</h1>
      <button onClick={handleStreamingToggle}>
        {isStreaming ? 'Stop Sharing' : 'Start Sharing'}
      </button>
      <input type="file" accept="audio/mp3" onChange={handleMp3Upload} />
      <button onClick={playAllSongs}>Play All Songs</button>
    </div>
  );
}

export default App;
