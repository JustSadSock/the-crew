export class Starfield {
  constructor(count, width, height) {
    this.count = count;
    this.width = width;
    this.height = height;
    this.stars = [];
    this.init();
  }

  init() {
    this.stars = [];
    for (let i = 0; i < this.count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 0.5 + Math.random() * 1.5
      });
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.init();
  }

  update() {
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      ctx.fillRect(s.x, s.y, 2, 2);
    }
  }
}
