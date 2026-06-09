const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {};
let displaySocket = null;
let isPlaying = false;
let targetStack = [];

const colors = ['red', 'yellow', 'green', 'blue', 'black'];

io.on('connection', (socket) => {
    
    // 1. 전광판 등록
    socket.on('registerDisplay', () => {
        displaySocket = socket.id;
        broadcastPlayerList();
    });

    // 2. 플레이어 접속
    socket.on('join', (nickname) => {
        // ⭐ 점수(score) 속성 추가
        players[socket.id] = { name: nickname, score: 0 };
        broadcastPlayerList();
        
        if (isPlaying) {
            socket.emit('phaseChange', 'playing');
        } else {
            socket.emit('phaseChange', 'lobby');
        }
    });

    // 접속자 명단(이름+점수)을 전광판으로 전송
    function broadcastPlayerList() {
        const list = Object.values(players).map(p => ({ name: p.name, score: p.score }));
        io.emit('updatePlayerList', list);
    }

    // 3. 게임 시작 로직
    socket.on('startGame', () => {
        if (Object.keys(players).length === 0) return;
        isPlaying = true;
        startNewRound();
    });

    function startNewRound() {
        targetStack = [...colors].sort(() => Math.random() - 0.5);
        io.emit('roundStart', targetStack);
        io.emit('phaseChange', 'playing');
    }

    // 4. 할리갈리 종(SLAP) 쳤을 때 정답 판정
    socket.on('slap', (myStack) => {
        if (!isPlaying) return;
        
        let isCorrect = true;
        
        if (myStack.length !== 5) {
            isCorrect = false;
        } else {
            for (let i = 0; i < 5; i++) {
                if (myStack[i] !== targetStack[i]) {
                    isCorrect = false;
                    break;
                }
            }
        }

        if (isCorrect) {
            isPlaying = false;
            
            // ⭐ 정답을 맞힌 플레이어 점수 1점 증가
            if (players[socket.id]) {
                players[socket.id].score += 1;
            }
            
            const winnerName = players[socket.id] ? players[socket.id].name : '누군가';
            
            io.emit('roundWinner', { winnerName: winnerName });
            broadcastPlayerList(); // 점수가 올랐으니 전광판 갱신
            io.emit('phaseChange', 'round_end');
            
            setTimeout(() => {
                io.emit('phaseChange', 'lobby');
            }, 4000);
        } else {
            socket.emit('wrongSlap');
        }
    });

    // 5. 플레이어 접속 해제
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            broadcastPlayerList();
        }
        if (socket.id === displaySocket) {
            displaySocket = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`할리갈리 컵스 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
