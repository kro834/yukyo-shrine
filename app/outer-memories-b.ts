/** Old inns, baths, post offices and record parlours built with shared PBR materials. */
type Mat = 'planks' | 'wood' | 'plaster' | 'stone' | 'rust' | 'tatami' | 'paper' | 'tile' | 'rope' | 'dark' | 'gold' | 'washiLit' | 'water' | 'red' | 'black' | 'steel';
type Room = { x1: number; x2: number; z1: number; z2: number };
type Builder = {
  box: (x: number, y: number, z: number, w: number, h: number, d: number, m: Mat) => void;
  cylinder: (x: number, y: number, z: number, r: number, h: number, m: Mat, rb?: number) => void;
  fixture: (x: number, y: number, z: number, color: string) => void;
  block: (x: number, z: number, w: number, d: number, h?: number) => void;
};
type Prop = Pick<Builder, 'box' | 'cylinder'>;
type Piece = { kind: 'box'; x: number; y: number; z: number; w: number; h: number; d: number; m: Mat }
  | { kind: 'cylinder'; x: number; y: number; z: number; r: number; h: number; m: Mat; rb: number };

const IDS = ['outer-rain-inn', 'outer-bathhouse', 'outer-post-office', 'outer-record-parlor'];

function book(g: Prop, x: number, y: number, z: number, w = .40, d = .28) {
  g.box(x, y + .018, z, w, .036, d, 'dark');
  g.box(x, y + .043, z, w - .025, .020, d - .025, 'paper');
  g.box(x - .012, y + .062, z + .009, w, .018, d, 'wood');
}

function bench(g: Prop, x: number, z: number, width: number, back = false) {
  for (const side of [-1, 1]) {
    g.box(x + side * (width / 2 - .12), .225, z, .13, .45, .57, 'wood');
    g.box(x + side * (width / 2 - .12), .12, z, .19, .055, .64, 'dark');
  }
  for (const dz of [-.21, 0, .21]) g.box(x, .475, z + dz, width, .075, .195, 'planks');
  g.box(x, .18, z, width - .22, .075, .075, 'wood');
  if (back) {
    for (const side of [-1, 1]) g.box(x + side * (width / 2 - .11), .83, z + .27, .065, .75, .065, 'wood');
    for (const y of [.75, .96]) g.box(x, y, z + .27, width - .12, .14, .06, 'planks');
  }
}

function trunk(g: Prop, x: number, bottom: number, z: number, w: number, d: number, h: number) {
  g.box(x, bottom + h * .43, z, w, h * .86, d, 'wood');
  g.box(x, bottom + h * .90, z, w + .025, h * .14, d + .025, 'dark');
  g.box(x, bottom + h, z, w - .045, .04, d - .04, 'planks');
  for (const side of [-1, 1]) {
    g.box(x + side * w * .29, bottom + h / 2, z - d / 2 - .012, .04, h * .94, .025, 'rope');
    g.box(x + side * w * .29, bottom + h + .024, z, .04, .013, d, 'rope');
    g.box(x + side * (w / 2 - .04), bottom + .07, z - d / 2 - .015, .09, .12, .025, 'rust');
  }
  g.box(x, bottom + h * .58, z - d / 2 - .019, .11, .14, .033, 'rust');
  g.box(x, bottom + h * .63, z - d / 2 - .040, .16, .035, .045, 'wood');
  for (const side of [-1, 1]) g.box(x + side * .073, bottom + h * .61, z - d / 2 - .026, .026, .075, .035, 'rust');
}

function quilt(g: Prop, x: number, y: number, z: number, width: number, depth: number, variant: number) {
  g.box(x, y, z, width, .115, depth, variant % 4 === 0 ? 'tatami' : 'paper');
  g.box(x + .018, y + .062, z + .009, width - .075, .025, depth - .06, 'paper');
  g.box(x, y - .005, z - depth / 2 - .008, width - .055, .023, .018, 'rope');
}

function bucket(g: Prop, x: number, y: number, z: number, r = .19) {
  g.cylinder(x, y + .14, z, r, .28, 'wood', r * .88);
  g.cylinder(x, y + .277, z, r + .009, .025, 'wood');
  g.cylinder(x, y + .293, z, r - .023, .007, 'black');
  for (const band of [.065, .225]) g.cylinder(x, y + band, z, r + .008, .018, 'rust');
  for (let seam = 0; seam < 8; seam++) {
    const a = seam * Math.PI / 4;
    g.box(x + Math.cos(a) * r, y + .145, z + Math.sin(a) * r, .008, .235, .008, 'dark');
  }
}

function stool(g: Prop, x: number, z: number) {
  g.box(x, .30, z, .49, .075, .39, 'planks');
  for (const side of [-1, 1]) {
    g.box(x + side * .15, .135, z, .065, .27, .30, 'wood');
    g.box(x + side * .15, .04, z, .095, .065, .36, 'wood');
  }
  g.box(x, .105, z, .31, .045, .05, 'wood');
}

function chair(g: Prop, x: number, z: number) {
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    g.box(x + side * .265, .24, z + end * .25, .065, .48, .065, 'wood');
  }
  g.box(x, .485, z, .65, .075, .61, 'planks');
  g.box(x, .539, z - .015, .53, .032, .50, 'tatami');
  for (const side of [-1, 1]) g.box(x + side * .265, .845, z + .25, .065, .80, .065, 'wood');
  for (const y of [.72, .92, 1.12]) g.box(x, y, z + .25, .56, .075, .055, 'wood');
  g.box(x, 1.265, z + .25, .66, .075, .075, 'dark');
  g.box(x, .20, z - .25, .55, .045, .045, 'wood');
}

/**
 * Recognized IDs return true, including reserved/undersized rooms with no props.
 * The root owns all floor, wall, ceiling and lighting signatures.
 */
export function buildOuterMemoriesB(id: string, room: Room, builder: Builder, reserved = false): boolean {
  if (!IDS.includes(id)) return false;
  const hw = (room.x2 - room.x1 + 1) * 2, hd = (room.z2 - room.z1 + 1) * 2;
  if (reserved || hw < 6 || hd < 6) return true;
  const cx = (room.x1 + room.x2) * 2, cz = (room.z1 + room.z2) * 2;

  // Each furniture group owns a tight footprint, rather than blocking its whole quadrant.
  const group = (sx: number, sz: number, build: (g: Prop) => void) => {
    const pieces: Piece[] = [];
    const g: Prop = {
      box: (x, y, z, w, h, d, m) => pieces.push({ kind: 'box', x, y, z, w, h, d, m }),
      cylinder: (x, y, z, r, h, m, rb = r) => pieces.push({ kind: 'cylinder', x, y, z, r, h, m, rb }),
    };
    build(g);
    if (!pieces.length) return;
    let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity, top = 0;
    for (const p of pieces) {
      const rx = p.kind === 'box' ? p.w / 2 : Math.max(p.r, p.rb);
      const rz = p.kind === 'box' ? p.d / 2 : Math.max(p.r, p.rb);
      x1 = Math.min(x1, p.x - rx); x2 = Math.max(x2, p.x + rx);
      z1 = Math.min(z1, p.z - rz); z2 = Math.max(z2, p.z + rz);
      top = Math.max(top, p.y + p.h / 2);
    }
    // Leaves >=2.65m clear from BOTH room axes, including blocker padding.
    if (Math.max(Math.abs(x1), Math.abs(x2), Math.abs(z1), Math.abs(z2)) > 1.38) {
      throw new Error('Outer memory prop exceeded its safe quadrant');
    }
    for (const p of pieces) {
      const x = cx + sx * (4.05 + p.x), z = cz + sz * (4.05 + p.z);
      if (p.kind === 'box') builder.box(x, p.y, z, p.w, p.h, p.d, p.m);
      else builder.cylinder(x, p.y, z, p.r, p.h, p.m, p.rb);
    }
    builder.block(cx + sx * (4.05 + (x1 + x2) / 2), cz + sz * (4.05 + (z1 + z2) / 2), x2 - x1 + .03, z2 - z1 + .03, top + .01);
  };

  if (id === 'outer-rain-inn') {
    // 雨待ちの旧旅籠: deep reception desk, key cubbies and a single brass bell.
    group(-1, -1, g => {
      g.box(0, .51, .10, 2.40, 1.02, .79, 'wood');
      g.box(0, .51, -.303, 2.15, .70, .028, 'dark');
      for (const x of [-.87, -.44, 0, .44, .87]) g.box(x, .51, -.327, .045, .72, .034, 'wood');
      for (const y of [.15, .87]) g.box(0, y, -.328, 2.26, .06, .044, 'planks');
      g.box(0, 1.06, .10, 2.58, .105, .94, 'planks');
      g.box(0, .065, .10, 2.46, .13, .84, 'dark');
      for (const x of [-.72, .0, .72]) {
        g.box(x, .86, -.352, .60, .15, .04, 'wood');
        g.box(x, .865, -.378, .14, .024, .035, 'gold');
      }
      book(g, -.72, 1.12, -.05, .46, .31);
      g.cylinder(.59, 1.151, -.07, .10, .045, 'gold', .12);
      g.cylinder(.59, 1.193, -.07, .022, .050, 'gold');
      g.box(.0, 1.68, .39, 1.68, .82, .075, 'dark');
      for (const x of [-.86, .86]) g.box(x, 1.69, .40, .065, .91, .22, 'wood');
      for (const y of [1.25, 1.53, 1.81, 2.10]) g.box(0, y, .335, 1.77, .055, .25, 'wood');
      for (const x of [-.51, -.17, .17, .51]) g.box(x, 1.68, .337, .04, .79, .245, 'wood');
      for (let key = 0; key < 7; key++) {
        const x = -.67 + (key % 5) * .335, y = key < 5 ? 1.42 : 1.72;
        g.box(x, y, .218, .011, .092, .012, 'rope');
        g.box(x, y - .06, .219, .05, .04, .015, 'gold');
      }
    });
    group(1, -1, g => {
      trunk(g, -.65, .025, -.10, .88, .73, .52);
      trunk(g, -.61, .60, -.08, .75, .61, .31);
    });
    group(1, -1, g => {
      trunk(g, .62, .025, -.10, .90, .74, .64);
      g.box(.62, .72, -.10, .83, .10, .69, 'paper');
      for (const x of [.40, .84]) g.box(x, .778, -.10, .032, .016, .69, 'rope');
    });
    group(1, -1, g => {
      g.cylinder(.54, .25, .99, .23, .50, 'wood');
      g.cylinder(.54, .506, .99, .24, .032, 'rust');
      g.cylinder(.54, .526, .99, .19, .005, 'black');
      for (let i = 0; i < 3; i++) {
        const x = .42 + i * .10, z = .95 + (i % 2) * .10;
        g.cylinder(x, .90, z, .036, .92 + i * .09, 'paper', .087);
        g.cylinder(x, 1.46 + i * .045, z, .012, .22, 'wood');
        g.box(x + .04, 1.56 + i * .045, z, .10, .032, .032, 'wood');
      }
    });
    group(-1, 1, g => {
      g.box(0, 1.25, .49, 2.44, 2.31, .05, 'dark');
      for (const x of [-1.21, 1.21]) g.box(x, 1.24, .20, .11, 2.48, .75, 'wood');
      for (const y of [.095, 1.11, 2.24, 2.48]) g.box(0, y, .20, 2.53, .095, .78, 'planks');
      g.box(0, 1.19, .20, .075, 2.24, .72, 'wood');
      for (const side of [-1, 1]) {
        for (let layer = 0; layer < 5; layer++) quilt(g, side * .59 + (layer % 2 ? .02 : -.02), .25 + layer * .165, .11, 1.02, .57, layer);
        for (let layer = 0; layer < 4; layer++) quilt(g, side * .59 + (layer % 2 ? -.015 : .015), 1.26 + layer * .18, .11, 1.00, .57, layer + 2);
      }
    });
    group(1, 1, g => bench(g, 0, -.64, 2.12, true));
    group(1, 1, g => {
      for (const x of [-1.0, 1.0]) g.box(x, .34, .85, .075, .68, .47, 'wood');
      for (const y of [.13, .39, .67]) g.box(0, y, .85, 2.13, .055, .50, 'planks');
      for (let pair = 0; pair < 3; pair++) for (const foot of [-1, 1]) {
        const x = -.70 + pair * .70 + foot * .11;
        g.box(x, .435, .82, .16, .035, .31, 'wood');
        g.box(x, .468, .76, .17, .024, .035, 'rope');
        g.box(x, .470, .84, .032, .025, .16, 'rope');
      }
    });
  } else if (id === 'outer-bathhouse') {
    // 忘れ湯の浴場: a tiled tub and its low, separate wash furniture.
    group(-1, -1, g => {
      g.box(0, .065, 0, 2.58, .13, 2.45, 'stone');
      for (const x of [-1.20, 1.20]) g.box(x, .395, 0, .17, .66, 2.33, 'tile');
      for (const z of [-1.12, 1.12]) g.box(0, .395, z, 2.40, .66, .17, 'tile');
      for (const x of [-1.205, 1.205]) g.box(x, .765, 0, .21, .10, 2.48, 'stone');
      for (const z of [-1.135, 1.135]) g.box(0, .765, z, 2.61, .10, .21, 'stone');
      g.box(0, .538, 0, 2.15, .025, 2.06, 'water');
      for (let column = 0; column < 9; column++) for (const y of [.28, .57]) {
        g.box(-1.05 + column * .263, y, -1.211, .245, .258, .025, (column + Math.round(y * 10)) % 7 === 0 ? 'plaster' : 'tile');
      }
      g.box(.75, .86, .84, .09, .24, .09, 'rust');
      g.box(.67, .973, .77, .24, .055, .18, 'steel');
      g.cylinder(.60, .925, .70, .033, .082, 'steel');
    });
    group(1, -1, g => {
      g.box(0, .85, .62, 2.53, 1.70, .15, 'plaster');
      g.box(0, .49, .526, 2.52, .90, .045, 'tile');
      for (let column = 0; column < 8; column++) g.box(-1.10 + column * .315, .53, .495, .025, .84, .018, 'dark');
      for (const x of [-.66, .66]) {
        g.box(x, 1.34, .526, .54, .63, .035, 'water');
        for (const side of [-1, 1]) g.box(x + side * .289, 1.34, .512, .035, .69, .055, 'rust');
        for (const y of [.999, 1.68]) g.box(x, y, .512, .61, .035, .055, 'rust');
        g.box(x, .76, .438, .065, .245, .095, 'steel');
        g.box(x, .883, .328, .065, .055, .27, 'steel');
        g.cylinder(x, .821, .215, .034, .085, 'steel');
        g.cylinder(x, .918, .442, .045, .035, 'gold');
        g.box(x, .942, .442, .14, .026, .025, 'steel');
        g.box(x, .942, .442, .025, .026, .14, 'steel');
      }
    });
    for (const side of [-1, 1]) group(1, -1, g => stool(g, side * .65, -.67));
    group(-1, 1, g => {
      bench(g, 0, -.50, 2.30);
      for (let layer = 0; layer < 3; layer++) quilt(g, .67, .58 + layer * .085, -.50, .47, .36, layer);
    });
    group(-1, 1, g => {
      for (const side of [-1, 1]) {
        const x = side * .64;
        g.box(x, .07, .83, .62, .14, .56, 'wood');
        for (let rail = 0; rail < 4; rail++) {
          const y = .18 + rail * .10;
          for (const edge of [-1, 1]) g.box(x, y, .83 + edge * .27, .66, .045, .025, 'rope');
          for (const edge of [-1, 1]) g.box(x + edge * .31, y, .83, .025, .045, .56, 'rope');
        }
        for (const edge of [-1, 1]) g.box(x + edge * .30, .29, .83, .028, .44, .57, 'wood');
        g.box(x, .29, .84, .47, .18, .38, 'paper');
      }
    });
    group(1, 1, g => {
      for (const x of [-1.10, 1.10]) g.box(x, .73, .70, .075, 1.46, .47, 'wood');
      for (const y of [.08, .71, 1.38]) g.box(0, y, .70, 2.28, .065, .51, 'planks');
      for (let index = 0; index < 4; index++) bucket(g, -.84 + index * .56, .12, .70, .19);
      for (let index = 0; index < 3; index++) bucket(g, -.70 + index * .70, .75, .70, .19);
    });
    for (const x of [-.69, .69]) group(1, 1, g => bucket(g, x, .015, -.64, .23));
  } else if (id === 'outer-post-office') {
    // 宛先のない郵便局: dense open pigeonholes, a brass grille and tied parcels.
    group(-1, -1, g => {
      g.box(0, 1.19, .43, 2.43, 2.31, .05, 'dark');
      for (const x of [-1.23, 1.23]) g.box(x, 1.20, .17, .10, 2.40, .60, 'wood');
      for (let row = 0; row <= 6; row++) g.box(0, .14 + row * .35, .17, 2.56, .058, .62, 'planks');
      for (let column = 1; column < 6; column++) g.box(-1.20 + column * .40, 1.19, .17, .043, 2.04, .60, 'wood');
      g.box(0, 2.38, .17, 2.65, .12, .69, 'wood');
      g.box(0, .05, .17, 2.57, .10, .64, 'dark');
      for (let row = 0; row < 6; row++) for (let column = 0; column < 6; column++) {
        if ((row * 3 + column) % 4 === 1) continue;
        const x = -1 + column * .40, y = .202 + row * .35, z = .15 + ((row + column) % 3) * .024;
        g.box(x, y, z, .28, .053, .33, 'paper');
        if ((row + column) % 2 === 0) g.box(x - .009, y + .043, z + .022, .25, .026, .31, 'paper');
        if ((row + column) % 5 === 0) g.box(x, y + .035, z, .023, .018, .34, 'rope');
      }
    });
    group(1, -1, g => {
      g.box(0, .50, .04, 2.39, 1.0, .80, 'wood');
      g.box(0, .49, -.371, 2.18, .72, .035, 'dark');
      for (const x of [-.78, -.39, 0, .39, .78]) g.box(x, .49, -.398, .058, .74, .038, 'wood');
      for (const y of [.11, .87]) g.box(0, y, -.408, 2.28, .075, .045, 'planks');
      g.box(0, 1.045, .04, 2.60, .105, .98, 'planks');
      for (const x of [-1.12, 1.12]) g.box(x, 1.61, .245, .075, 1.10, .075, 'wood');
      for (const y of [1.11, 1.60, 2.13]) g.box(0, y, .245, 2.29, .026, .035, 'gold');
      for (let bar = -5; bar <= 5; bar++) {
        const x = bar * .207, short = Math.abs(x) < .38;
        g.box(x, short ? 1.87 : 1.62, .245, .021, short ? .51 : 1.01, .025, 'gold');
      }
      g.box(0, 1.105, -.23, .51, .021, .29, 'black');
      g.box(-.67, 1.137, -.02, .40, .061, .31, 'paper');
      g.box(-.67, 1.174, -.02, .027, .015, .32, 'rope');
      g.box(.73, 1.122, -.14, .23, .035, .17, 'black');
      g.cylinder(.72, 1.19, -.13, .025, .11, 'wood');
      g.box(.72, 1.244, -.13, .09, .045, .057, 'wood');
    });
    group(-1, 1, g => {
      for (const side of [-1, 1]) for (const end of [-1, 1]) g.box(side * .99, .37, end * .32, .09, .74, .09, 'wood');
      g.box(0, .74, 0, 2.28, .09, .86, 'planks');
      g.box(0, .21, 0, 2.02, .065, .69, 'wood');
      for (let index = 0; index < 3; index++) {
        const x = -.68 + index * .68, y = .34;
        g.box(x, y, 0, .57, .21, .50, 'paper');
        g.box(x, y + .111, 0, .034, .018, .51, 'rope');
        g.box(x, y + .111, 0, .58, .018, .03, 'rope');
      }
      g.box(-.71, .92, .03, .70, .27, .61, 'paper');
      g.box(-.71, 1.064, .03, .035, .018, .62, 'rope');
      g.box(-.71, 1.064, .03, .71, .018, .03, 'rope');
      g.box(.52, .81, .05, .69, .06, .57, 'wood');
      g.cylinder(.52, 1.04, .12, .045, .42, 'gold', .095);
      g.box(.52, 1.26, .12, .77, .045, .042, 'steel');
      for (const side of [-1, 1]) {
        const x = .52 + side * .31;
        g.cylinder(x, 1.13, .12, .008, .23, 'steel');
        g.cylinder(x, .991, .12, .20, .037, 'steel', .12);
      }
    });
    group(1, 1, g => {
      g.box(-.70, .075, -.31, .72, .15, .72, 'stone');
      g.cylinder(-.70, .40, -.31, .16, .52, 'dark', .21);
      g.cylinder(-.70, 1.055, -.31, .30, .93, 'red');
      g.cylinder(-.70, 1.59, -.31, .035, .20, 'red', .325);
      g.cylinder(-.70, 1.494, -.31, .329, .055, 'red');
      g.box(-.70, 1.282, -.616, .29, .065, .018, 'black');
      g.box(-.70, 1.339, -.636, .36, .036, .10, 'red');
      g.box(-.70, .835, -.611, .21, .30, .025, 'red');
      g.box(-.62, .865, -.63, .028, .058, .022, 'gold');
    });
    group(1, 1, g => {
      for (const side of [-1, 1]) {
        const z = side * .51, x = .68;
        g.cylinder(x, .285, z, .17, .54, 'paper', .27);
        g.cylinder(x, .581, z, .084, .10, 'rope');
        g.cylinder(x, .673, z, .12, .10, 'paper', .078);
        g.box(x + .09, .625, z, .17, .021, .027, 'rope');
      }
    });
  } else {
    // 夕凪の蓄音室: record sleeves, a black platter, crank and an upturned brass horn.
    group(-1, -1, g => {
      for (const x of [-1.14, 1.14]) g.box(x, .94, .19, .11, 1.88, .72, 'wood');
      g.box(0, .97, .525, 2.25, 1.69, .05, 'dark');
      for (const y of [.13, .80, 1.78]) g.box(0, y, .19, 2.43, .08, .77, 'planks');
      g.box(0, 1.91, .19, 2.56, .10, .85, 'wood');
      for (const side of [-1, 1]) {
        g.box(side * .565, .475, -.211, 1.08, .56, .04, 'wood');
        g.box(side * .565, .478, -.243, .19, .03, .041, 'gold');
      }
      for (let sleeve = 0; sleeve < 18; sleeve++) {
        const x = -1.05 + sleeve * .123, h = .67 + (sleeve % 3) * .06;
        g.box(x, .845 + h / 2, .11, .072, h, .53, sleeve % 5 === 0 ? 'black' : sleeve % 3 === 0 ? 'dark' : 'paper');
        if (sleeve % 3 === 0) g.box(x, 1.30, -.163, .049, .03, .012, 'rope');
      }
      for (let disc = 0; disc < 3; disc++) g.cylinder(-.66, 1.978 + disc * .018, .13, .28, .016, 'black');
      g.cylinder(-.66, 2.009, .13, .047, .006, 'paper');
    });
    group(1, -1, g => {
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        g.box(side * .66, .35, end * .50, .09, .70, .09, 'wood');
      }
      g.box(0, .74, 0, 1.64, .10, 1.30, 'planks');
      g.box(0, .18, 0, 1.35, .06, .97, 'wood');
      g.box(0, .875, 0, 1.18, .18, .94, 'wood');
      g.box(0, .975, 0, 1.24, .04, .99, 'dark');
      g.box(0, .835, -.484, .75, .065, .026, 'wood');
      g.box(0, .836, -.508, .17, .024, .023, 'gold');
      g.cylinder(-.20, 1.016, -.09, .325, .032, 'black');
      g.cylinder(-.20, 1.037, -.09, .050, .008, 'paper');
      g.cylinder(-.20, 1.062, -.09, .010, .057, 'steel');
      g.cylinder(.42, 1.067, .29, .038, .16, 'gold');
      g.box(.28, 1.112, .29, .32, .027, .032, 'gold');
      g.box(.11, 1.112, .19, .028, .027, .23, 'gold');
      g.box(.067, 1.084, .079, .10, .041, .073, 'black');
      g.cylinder(.48, 1.361, .32, .375, .45, 'gold', .041);
      g.cylinder(.48, 1.587, .32, .385, .027, 'gold');
      g.cylinder(.48, 1.603, .32, .341, .007, 'black');
      g.box(-.716, .902, .11, .27, .031, .039, 'steel');
      g.box(-.849, .973, .11, .027, .17, .037, 'steel');
      g.box(-.894, 1.055, .11, .11, .054, .065, 'wood');
    });
    for (const side of [-1, 1]) group(-1, 1, g => chair(g, side * .69, .13));
    group(1, 1, g => {
      g.cylinder(-.52, .59, -.42, .49, .09, 'planks');
      g.cylinder(-.52, .29, -.42, .060, .55, 'wood', .09);
      g.box(-.52, .055, -.42, .66, .11, .13, 'wood');
      g.box(-.52, .055, -.42, .13, .11, .66, 'wood');
      book(g, -.62, .645, -.47, .32, .24);
      g.cylinder(-.25, .693, -.25, .063, .09, 'tile', .047);
      g.cylinder(-.25, .739, -.25, .048, .006, 'black');
      g.box(-.184, .699, -.25, .042, .045, .05, 'tile');
    });
    group(1, 1, g => {
      g.box(.59, .075, .71, 1.00, .15, .61, 'wood');
      for (const x of [.08, 1.10]) g.box(x, .35, .71, .055, .68, .64, 'wood');
      for (const y of [.19, .42, .64]) g.box(.59, y, .395, 1.04, .065, .055, 'planks');
      g.box(.59, .36, 1.006, 1.04, .53, .045, 'wood');
      for (let sleeve = 0; sleeve < 6; sleeve++) {
        g.box(.22 + sleeve * .147, .434, .71, .082, .56 + (sleeve % 2) * .04, .48, sleeve % 3 === 0 ? 'dark' : 'paper');
      }
    });
  }
  return true;
}
