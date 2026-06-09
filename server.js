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
        players[socket.id] = { name: nickname };
        broadcastPlayerList();
        
        // 게임 중 난입 처리
        if (isPlaying) {
            socket.emit('phaseChange', 'playing');
        } else {
            socket.emit('phaseChange', 'lobby');
        }
    });

    // 접속자 명단을 전광판으로 전송
    function broadcastPlayerList() {
        const list = Object.values(players).map(p => p.name);
        io.emit('updatePlayerList', list);
    }

    // 3. 게임 시작 로직 (전광판에서 버튼 클릭 시)
    socket.on('startGame', () => {
        if (Object.keys(players).length === 0) return;
        isPlaying = true;
        startNewRound();
    });

    // 새로운 라운드의 목표 컵 타워 생성
    function startNewRound() {
        // 5가지 색상을 랜덤으로 섞어서 정답 스택 생성
        targetStack = [...colors].sort(() => Math.random() - 0.5);
        
        io.emit('roundStart', targetStack);
        io.emit('phaseChange', 'playing');
    }

    // 4. 할리갈리 종(SLAP) 쳤을 때 정답 판정
    socket.on('slap', (myStack) => {
        if (!isPlaying) return;
        
        let isCorrect = true;
        
        // 5개를 다 쌓지 않았거나, 순서가 하나라도 다르면 오답 처리
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
            // 정답 처리
            isPlaying = false;
            const winnerName = players[socket.id] ? players[socket.id].name : '누군가';
            
            io.emit('roundWinner', { winnerName: winnerName });
            io.emit('phaseChange', 'round_end');
            
            // 4초 뒤 대기실 상태로 초기화 (전광판 연출 시간 대기)
            setTimeout(() => {
                io.emit('phaseChange', 'lobby');
            }, 4000);
        } else {
            // 오답 처리 (해당 플레이어에게만 3초 정지 페널티 전송)
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
