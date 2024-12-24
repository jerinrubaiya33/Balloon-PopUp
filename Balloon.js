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

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());

        this.balloonContainer.addEventListener('click', (e) => this.handleInteraction(e));
        this.balloonContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInteraction(e.touches[0]);
        });
    }

    handleInteraction(event) {
        if (!this.isPlaying) return;

        if (this.checkBirdCollision(event.clientX, event.clientY)) {
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
        document.getElementById('game-over').classList.add('hidden');

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

        this.showScoreIndicator(balloon, '+1', color);

        setTimeout(() => {
            if (balloon.parentNode) {
                balloon.remove();
            }
        }, duration * 1000);
    }

    popBalloon(balloon, x, y) {
        if (balloon.classList.contains('popping')) return;

        balloon.classList.add('popping');
        const color = getComputedStyle(balloon).getPropertyValue('--balloon-color');
        this.createPopEffect(x, y, color);
        this.score += 1;
        this.updateScore();

        this.showScoreIndicator(balloon, '+1', color);

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
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();

            if (this.timeLeft <= 0) {
                this.gameOver();
            }
        }, 1000);
    }

    updateScore() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
    }

    updateTimer() {
        document.getElementById('timer').textContent = `Time: ${this.timeLeft}s`;
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

        if (this.thunderstorm) this.thunderstorm.remove();
    }

    createBird() {
        const bird = document.createElement('div');
        bird.className = 'bird';
        const startFromLeft = Math.random() < 0.5;
        bird.classList.add(startFromLeft ? 'bird-left' : 'bird-right');

        const startY = Math.random() * (window.innerHeight - 60);
        bird.style.top = `${startY}px`;
        bird.style.left = startFromLeft ? '-60px' : `${window.innerWidth}px`;

        this.gameContainer.appendChild(bird);

        const birdObj = {
            element: bird,
            direction: startFromLeft ? 1 : -1,
            speed: 1 + Math.random() * 3,
            verticalDirection: Math.random() < 0.5 ? 1 : -1,
            verticalSpeed: 0.5 + Math.random() * 2
        };

        this.birds.push(birdObj);
        this.moveBird(birdObj);
    }

    moveBird(birdObj) {
        if (!this.isPlaying) return;

        const birdRect = birdObj.element.getBoundingClientRect();
        let newX = birdRect.left + birdObj.direction * birdObj.speed;
        let newY = birdRect.top + birdObj.verticalDirection * birdObj.verticalSpeed;

        if (newX <= -60 || newX >= window.innerWidth) {
            this.removeBird(birdObj);
            return;
        }

        if (newY <= 0 || newY + birdRect.height >= window.innerHeight) {
            birdObj.verticalDirection *= -1;
        }

        birdObj.element.style.left = `${newX}px`;
        birdObj.element.style.top = `${newY}px`;

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
                x >= birdRect.left &&
                x <= birdRect.right &&
                y >= birdRect.top &&
                y <= birdRect.bottom
            );
        });
    }

    clearBirds() {
        this.birds.forEach(bird => bird.element.remove());
        this.birds = [];
    }
    
    startBirdSpawning() {
        this.birdSpawnIntervalId = setInterval(() => {
            if (this.isPlaying && this.birds.length < this.maxBirds) {
                this.createBird();
            }
        }, this.birdSpawnInterval);
    }

    initCustomCursor() {
        const cursor = document.getElementById('custom-cursor');
        if (!cursor) {
            console.error('Custom cursor element is missing in the HTML.');
            return;
        }
    
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
        // Hide the cursor on touch devices
        if (isTouchDevice) {
            document.body.style.cursor = 'auto';  // Use default cursor for touch devices
            cursor.style.display = 'none';  // Hide the custom cursor
            document.body.addEventListener('touchstart', (e) => {
                if (this.isPlaying && this.checkBirdCollision(e.touches[0].clientX, e.touches[0].clientY)) {
                    this.gameOver("Game Over! You touched a bird!");
                }
            });
            return;
        }
    
        // For desktop, show the custom cursor
        document.body.style.cursor = 'none';
        cursor.style.display = 'block';
    
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;
    
            if (this.isPlaying && this.checkBirdCollision(e.clientX, e.clientY)) {
                this.gameOver("Game Over! You touched a bird!");
            }
        });
    }
    
    createRainEffect() {
        const rainContainer = document.createElement('div');
        rainContainer.id = 'rain-container';
        this.gameContainer.appendChild(rainContainer);

        for (let i = 0; i < 100; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'rain-drop';
            raindrop.style.left = `${Math.random() * 100}%`;
            raindrop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
            raindrop.style.animationDelay = `${Math.random()}s`;
            rainContainer.appendChild(raindrop);
        }
    }

    createThunderstorm() {
        const thunderstorm = document.createElement('div');
        thunderstorm.className = 'thunderstorm';
        this.gameContainer.appendChild(thunderstorm);
        this.thunderstorm = thunderstorm;
    }

    moveThunderstorm() {
        if (!this.isPlaying) return;

        const thunderstormRect = this.thunderstorm.getBoundingClientRect();
        this.checkBalloonCollisionWithThunderstorm(thunderstormRect);

        requestAnimationFrame(() => this.moveThunderstorm());
    }

    checkBalloonCollisionWithThunderstorm(thunderstormRect) {
        const balloons = document.querySelectorAll('.balloon');
        balloons.forEach(balloon => {
            const balloonRect = balloon.getBoundingClientRect();
            if (this.isColliding(balloonRect, thunderstormRect)) {
                this.popBalloonByThunderstorm(balloon);
            }
        });
    }

    popBalloonByThunderstorm(balloon) {
        if (balloon.classList.contains('popping')) return;

        balloon.classList.add('popping');
        const color = getComputedStyle(balloon).getPropertyValue('--balloon-color');
        const balloonRect = balloon.getBoundingClientRect();
        this.createPopEffect(balloonRect.left + balloonRect.width / 2, balloonRect.top + balloonRect.height / 2, color);
        this.score -= 1;
        this.updateScore();

        this.showScoreIndicator(balloon, '-1', color);

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

    showScoreIndicator(balloon, text, color) {
        const indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        indicator.textContent = text;
        indicator.style.color = color;
        indicator.style.position = 'absolute';
        const balloonRect = balloon.getBoundingClientRect();
        indicator.style.left = `${balloonRect.right}px`;
        indicator.style.top = `${balloonRect.top + balloonRect.height / 2}px`;
        indicator.style.fontSize = '24px';
        indicator.style.fontWeight = 'bold';
        indicator.style.pointerEvents = 'none';
        indicator.style.animation = 'fadeOut 1s ease-out forwards';
        indicator.style.transform = 'translateY(-50%)';

        this.gameContainer.appendChild(indicator);

        setTimeout(() => indicator.remove(), 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BalloonGame();
});