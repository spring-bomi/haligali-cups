const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = {};
let gameState = 'lobby'; // lobby, playing, round_end
let targetStack = []; // 이번 라운드의 목표 컵 순서 (배열의 0번째가 맨 아래)
const colors = ['red', 'yellow', 'green', 'blue', 'black'];

// 배열을 무작위로 섞는 함수
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        if (name === 'DISPLAY') {
            socket.join('display');
            socket.emit('updateDisplay', { players, gameState, targetStack });
        } else {
            players[socket.id] = { name: name, score: 0 };
            io.emit('updateDisplay', { players, gameState, targetStack });
            socket.emit('phaseChange', gameState);
        }
    });

    socket.on('startGame', () => {
        gameState = 'playing';
        targetStack = shuffle([...colors]); // 5가지 색상을 무작위로 섞어 새 미션 생성
        io.emit('updateDisplay', { players, gameState, targetStack });
        io.emit('phaseChange', gameState);
    });

    socket.on('slap', (playerStack) => {
        if (gameState !== 'playing') return;

        // 클라이언트에서 보낸 스택과 정답 스택을 문자열로 변환하여 비교
        const isCorrect = JSON.stringify(playerStack) === JSON.stringify(targetStack);

        if (isCorrect) {
            // 정답! 라운드 종료
            gameState = 'round_end';
            players[socket.id].score += 1;
            io.emit('roundWinner', { winnerName: players[socket.id].name, targetStack });
            io.emit('updateDisplay', { players, gameState, targetStack });
        } else {
            // 오답! 해당 플레이어에게만 3초 패널티 신호 전송
            socket.emit('wrongSlap');
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updateDisplay', { players, gameState, targetStack });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`에어 할리갈리 서버가 ${PORT}포트에서 실행 중입니다.`); });