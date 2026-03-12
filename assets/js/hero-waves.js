const targetCanvas = document.getElementById("bg");

if (targetCanvas && window.p5) {
  new p5(function(p) {
    let t = 0;
    const d = 250;

    p.setup = function() {
      const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
      canvas.elt.id = "bg-canvas";
      canvas.parent(targetCanvas.parentElement);
      p.stroke(p.color("#bc4749"), 120);
      p.noFill();
      p.frameRate(30);
      p.clear();
    };

    p.draw = function() {
      p.background(255, 15);

      p.beginShape();
      for (let i = -1; i <= d; i++) {
        const x = p.map(i, 0, d, 0, p.width);
        const y =
          p.map(p.noise(i * 0.01, t * 0.005), 0, 1, 0, p.height) +
          p.map(i, 0, d, -p.height / 4, p.height / 2);

        p.curveVertex(x, y);
      }
      p.endShape();

      t += 1;
    };

    p.windowResized = function() {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  });
}
