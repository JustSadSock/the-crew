import { Starfield } from '../starfield.js';

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-1';

const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;
const stars = new Starfield(100, width, height);

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  stars.resize(width, height);
}
window.addEventListener('resize', resize);
resize();

function loop() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  stars.update();
  stars.draw(ctx);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
