class BalloonGame {
    constructor() {
        this.gameContainer = document.getElementById('game-container');
        this.balloonContainer = document.getElementById('balloon-container');
        this.score = 0;
        this.timeLeft = 40;
        this.isPlaying = false;
        this.balloons = [];
        this.colors = ['#FF6B6B', '#FF5733', '#FFA500', '#4ECDC4', '#8E44AD', '#FFC0CB', '#FF8C00'];

        this.birds = [];
        this.maxBirds = 3;
        this.birdSpawnInterval = 3000;

        this.initAudio();
        this.bindEvents();
        this.initCustomCursor();

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translateY(-50%) scale(1); }
                100% { opacity: 0; transform: translateY(-100%) scale(1.5); }
            }
            @keyframes pop {
                0% { transform: scale(1); }
                100% { transform: scale(1.5); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    initAudio() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = null;
        const setupContext = () => {
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();
            }
        };
        document.addEventListener('click', setupContext, { once: true });
        document.addEventListener('touchstart', setupContext, { once: true });
    }

    playSound(type) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const now = this.audioCtx.currentTime;

        if (type === 'pop') {
            const sampleRate = this.audioCtx.sampleRate;
            const noiseDuration = 0.06;
            const bufferSize = sampleRate * noiseDuration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSource = this.audioCtx.createBufferSource();
            noiseSource.buffer = buffer;

            const lowPass = this.audioCtx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.setValueAtTime(400, now); 
            lowPass.frequency.exponentialRampToValueAtTime(100, now + noiseDuration);

            const noiseGain = this.audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

            noiseSource.connect(lowPass);
            lowPass.connect(noiseGain);
            noiseGain.connect(this.audioCtx.destination);
            
            noiseSource.start(now);
            noiseSource.stop(now + noiseDuration);

            const thudOsc = this.audioCtx.createOscillator();
            const thudGain = this.audioCtx.createGain();
            thudOsc.type = 'sine';
            thudOsc.frequency.setValueAtTime(130, now);
            thudOsc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
            thudGain.gain.setValueAtTime(0.5, now);
            thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            thudOsc.connect(thudGain);
            thudGain.connect(this.audioCtx.destination);
            thudOsc.start(now);
            thudOsc.stop(now + 0.05);

        } else if (type === 'zap') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, now);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.3);

        } else if (type === 'birdHit') {
            [220, 261.63, 329.63].forEach((freq) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.5);
            });
        } else if (type === 'timeUp') {
            const chimeNotes = [261.63, 329.63, 392.00, 523.25];
            chimeNotes.forEach((freq, index) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                const noteTime = now + (index * 0.12);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, noteTime);
                gain.gain.setValueAtTime(0.15, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(noteTime);
                osc.stop(noteTime + 0.4);
            });
        }
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.showInstructions());
        document.getElementById('play-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());

        this.balloonContainer.addEventListener('click', (e) => this.handleInteraction(e));
        this.balloonContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInteraction(e.touches[0]);
        });
    }

    showInstructions() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('instructions-modal').classList.remove('hidden');
    }

    handleInteraction(event) {
        if (!this.isPlaying) return;

        if (this.checkBirdCollision(event.clientX, event.clientY)) {
            this.playSound('birdHit');
            this.gameOver("Game Over! You touched a bird!");
            return;
        }

        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (element && element.classList.contains('balloon')) {
            this.popBalloon(element, event.clientX, event.clientY);
        }
    }

    startGame() {
        this.score = 0;
        this.timeLeft = 40;
        this.isPlaying = true;
        this.updateScore();
        this.updateTimer();

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('instructions-modal').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');

        const oldOverlay = document.querySelector('.game-over-overlay');
        if (oldOverlay) oldOverlay.remove();

        this.clearBalloons();
        this.startSpawning();
        this.startTimer();
        this.clearBirds();
        this.startBirdSpawning();

        this.createRainEffect();
        this.createThunderstorm();
        this.moveThunderstorm();
    }

    startSpawning() {
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        this.spawnInterval = setInterval(() => {
            if (this.isPlaying) {
                this.spawnBalloon();
            }
        }, 800);
    }

    spawnBalloon() {
        const balloon = document.createElement('div');
        balloon.className = 'balloon';

        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const duration = 4 + Math.random() * 2;
        const rotation = -30 + Math.random() * 40;
        const startX = Math.random() * (window.innerWidth - 60);

        balloon.style.setProperty('--balloon-color', color);
        balloon.style.setProperty('--float-duration', `${duration}s`);
        balloon.style.setProperty('--rotation', `${rotation}deg`);
        balloon.style.left = `${startX}px`;

        this.balloonContainer.appendChild(balloon);

        setTimeout(() => {
            if (balloon.parentNode) {
                balloon.remove();
            }
        }, duration * 1000);
    }

    popBalloon(balloon, x, y) {
        if (balloon.classList.contains('popping')) return;

        balloon.classList.add('popping');
        const color = getComputedStyle(balloon).getPropertyValue('--balloon-color') || '#FF6B6B';
        
        this.playSound('pop');
        this.createPopEffect(x, y, color);
        this.score += 1;
        this.updateScore();

        this.showScoreIndicator(x, y, '+1', color);

        balloon.style.animation = 'pop 0.3s ease-out forwards';
        setTimeout(() => balloon.remove(), 300);
    }

    createPopEffect(x, y, color) {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.backgroundColor = color;
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;

            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = 100 + Math.random() * 50;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);

            this.gameContainer.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();

            if (this.timeLeft <= 0) {
                this.playSound('timeUp');
                this.gameOver("Time's Up!");
            }
        }, 1000);
    }

    updateScore() {
        document.querySelector('#score span').textContent = this.score;
    }

    updateTimer() {
        document.querySelector('#timer span').textContent = `${this.timeLeft}s`;
    }

    gameOver(message = "Game Over!") {
        this.isPlaying = false;
        clearInterval(this.spawnInterval);
        clearInterval(this.timerInterval);
        clearInterval(this.birdSpawnIntervalId);

        const overlay = document.createElement('div');
        overlay.className = 'game-over-overlay';
        overlay.textContent = message;
        this.gameContainer.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
            document.getElementById('game-over').classList.remove('hidden');
            document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
        }, 2000);

        this.clearBirds();

        const rainContainer = document.getElementById('rain-container');
        if (rainContainer) rainContainer.remove();

        if (this.thunderstorm) {
            this.thunderstorm.remove();
            this.thunderstorm = null;
        }
    }

    createBird() {
        const bird = document.createElement('div');
        bird.className = 'bird';
        const startFromLeft = Math.random() < 0.5;
        bird.classList.add(startFromLeft ? 'bird-left' : 'bird-right');

        const startY = Math.random() * (window.innerHeight - 100);
        bird.style.top = `${startY}px`;
        bird.style.left = startFromLeft ? '-80px' : `${window.innerWidth}px`;

        this.gameContainer.appendChild(bird);

        const birdObj = {
            element: bird,
            direction: startFromLeft ? 1 : -1,
            speed: 2 + Math.random() * 3,
            verticalDirection: Math.random() < 0.5 ? 1 : -1,
            verticalSpeed: 0.5 + Math.random() * 1.5
        };

        this.birds.push(birdObj);
        this.moveBird(birdObj);
    }

    moveBird(birdObj) {
        if (!this.isPlaying) return;

        const birdRect = birdObj.element.getBoundingClientRect();
        let newX = birdRect.left + birdObj.direction * birdObj.speed;
        let newY = birdRect.top + birdObj.verticalDirection * birdObj.verticalSpeed;

        if (birdObj.direction === 1 && newX > window.innerWidth) {
            this.removeBird(birdObj);
            return;
        } else if (birdObj.direction === -1 && newX < -80) {
            this.removeBird(birdObj);
            return;
        }

        if (newY <= 0 || newY + birdRect.height >= window.innerHeight) {
            birdObj.verticalDirection *= -1;
        }

        birdObj.element.style.left = `${newX}px`;
        birdObj.element.style.top = `${newY}px`;

        if (this.currentMouseX !== undefined && this.currentMouseY !== undefined) {
            if (this.checkBirdCollision(this.currentMouseX, this.currentMouseY)) {
                this.playSound('birdHit');
                this.gameOver("Game Over! You touched a bird!");
                return;
            }
        }

        requestAnimationFrame(() => this.moveBird(birdObj));
    }

    removeBird(birdObj) {
        const index = this.birds.indexOf(birdObj);
        if (index > -1) {
            this.birds.splice(index, 1);
            birdObj.element.remove();
        }
    }

    checkBirdCollision(x, y) {
        return this.birds.some(birdObj => {
            const birdRect = birdObj.element.getBoundingClientRect();
            return (
                x >= birdRect.left + 5 &&
                x <= birdRect.right - 5 &&
                y >= birdRect.top + 5 &&
                y <= birdRect.bottom - 5
            );
        });
    }

    clearBirds() {
        this.birds.forEach(bird => bird.element.remove());
        this.birds = [];
    }
    
    startBirdSpawning() {
        if (this.birdSpawnIntervalId) clearInterval(this.birdSpawnIntervalId);
        this.birdSpawnIntervalId = setInterval(() => {
            if (this.isPlaying && this.birds.length < this.maxBirds) {
                this.createBird();
            }
        }, this.birdSpawnInterval);
    }

    initCustomCursor() {
        const cursor = document.getElementById('custom-cursor');
        if (!cursor) return;
    
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
        if (isTouchDevice) {
            document.body.style.cursor = 'auto';
            cursor.style.display = 'none';

            document.addEventListener('touchmove', (e) => {
                if (!this.isPlaying) return;
                const touch = e.touches[0];
                if (this.checkBirdCollision(touch.clientX, touch.clientY)) {
                    this.playSound('birdHit');
                    this.gameOver("Game Over! You touched a bird!");
                }
            }, { passive: true });
            return;
        }
    
        document.body.style.cursor = 'none';
        cursor.style.display = 'block';
    
        document.addEventListener('mousemove', (e) => {
            this.currentMouseX = e.clientX;
            this.currentMouseY = e.clientY;

            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;

            if (this.isPlaying && this.checkBirdCollision(e.clientX, e.clientY)) {
                this.playSound('birdHit');
                this.gameOver("Game Over! You touched a bird!");
            }
        });
    }
    
    createRainEffect() {
        const oldRain = document.getElementById('rain-container');
        if (oldRain) oldRain.remove();

        const rainContainer = document.createElement('div');
        rainContainer.id = 'rain-container';
        this.gameContainer.appendChild(rainContainer);

        for (let i = 0; i < 60; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'rain-drop';
            raindrop.style.left = `${Math.random() * 100}%`;
            raindrop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
            raindrop.style.animationDelay = `${Math.random()}s`;
            rainContainer.appendChild(raindrop);
        }
    }

    createThunderstorm() {
        if (this.thunderstorm) this.thunderstorm.remove();

        const thunderstorm = document.createElement('div');
        thunderstorm.className = 'thunderstorm';
        this.gameContainer.appendChild(thunderstorm);
        this.thunderstorm = thunderstorm;
    }

    moveThunderstorm() {
        if (!this.isPlaying || !this.thunderstorm) return;

        const thunderstormRect = this.thunderstorm.getBoundingClientRect();
        this.checkBalloonCollisionWithThunderstorm(thunderstormRect);

        requestAnimationFrame(() => this.moveThunderstorm());
    }

    checkBalloonCollisionWithThunderstorm(thunderstormRect) {
        const balloons = document.querySelectorAll('.balloon');
        balloons.forEach(balloon => {
            const balloonRect = balloon.getBoundingClientRect();
            if (this.isColliding(balloonRect, thunderstormRect)) {
                this.popBalloonByThunderstorm(balloon, balloonRect);
            }
        });
    }

    popBalloonByThunderstorm(balloon, balloonRect) {
        if (balloon.classList.contains('popping')) return;

        balloon.classList.add('popping');
        const color = getComputedStyle(balloon).getPropertyValue('--balloon-color') || '#FF6B6B';
        
        const x = balloonRect.left + balloonRect.width / 2;
        const y = balloonRect.top + balloonRect.height / 2;
        
        this.playSound('zap');
        this.createPopEffect(x, y, color);
        this.score = Math.max(0, this.score - 1);
        this.updateScore();

        this.showScoreIndicator(x, y, '-1', color);

        balloon.style.animation = 'pop 0.3s ease-out forwards';
        setTimeout(() => balloon.remove(), 300);
    }

    isColliding(rect1, rect2) {
        return !(rect1.right < rect2.left || 
                 rect1.left > rect2.right || 
                 rect1.bottom < rect2.top || 
                 rect1.top > rect2.bottom);
    }

    clearBalloons() {
        const balloons = document.querySelectorAll('.balloon');
        balloons.forEach(balloon => balloon.remove());
    }

    showScoreIndicator(x, y, text, color) {
        const indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        indicator.textContent = text;
        indicator.style.color = color;
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;

        this.gameContainer.appendChild(indicator);
        setTimeout(() => indicator.remove(), 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BalloonGame();
});
