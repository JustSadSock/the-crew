import { Starfield } from './starfield.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;

const starfield = new Starfield(100, width, height);
const ship = { x: width / 2, y: height - 60, size: 20 };

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  starfield.resize(width, height);
  ship.x = width / 2;
  ship.y = height - 60;
}
window.addEventListener('resize', resize);
resize();

function update() {
  starfield.update();
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  starfield.draw(ctx);

  ctx.fillStyle = '#0f0';
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y);
  ctx.lineTo(ship.x - ship.size, ship.y + ship.size * 1.5);
  ctx.lineTo(ship.x + ship.size, ship.y + ship.size * 1.5);
  ctx.closePath();
  ctx.fill();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('keydown', e => {
  const step = 5;
  if (e.key === 'ArrowLeft') ship.x -= step;
  if (e.key === 'ArrowRight') ship.x += step;
  if (e.key === 'ArrowUp') ship.y -= step;
  if (e.key === 'ArrowDown') ship.y += step;
  ship.x = Math.max(ship.size, Math.min(width - ship.size, ship.x));
  ship.y = Math.max(ship.size, Math.min(height - ship.size * 1.5, ship.y));
});
