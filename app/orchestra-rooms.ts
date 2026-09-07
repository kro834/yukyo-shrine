/** Gothic instrument furniture keeps the central entrance cross clear. */
type Mat = 'black' | 'dark' | 'stone' | 'gold' | 'red' | 'paper' | 'rust';
type Room = { x1: number; x2: number; z1: number; z2: number };
type Builder = {
  box: (x: number, y: number, z: number, w: number, h: number, d: number, m: Mat) => void;
  cylinder: (x: number, y: number, z: number, r: number, h: number, m: Mat, rb?: number) => void;
  fixture: (x: number, y: number, z: number, color: string) => void;
  block: (x: number, z: number, w: number, d: number, h?: number) => void;
};
type Prop = Pick<Builder, 'box' | 'cylinder'>;

export const ORCHESTRA_ROOMS = [
  { id: 'orchestra-organ', name: '沈黙のパイプオルガン堂', floor: 'stone', wall: 'stone', accent: 'gold', light: 'amber' },
  { id: 'orchestra-strings', name: '弓音の消えた弦楽室', floor: 'dark', wall: 'stone', accent: 'red', light: 'moon' },
  { id: 'orchestra-curtain', name: '緞帳の閉ざされた小舞台', floor: 'dark', wall: 'stone', accent: 'red', light: 'ember' },
  { id: 'orchestra-clock', name: '忘れられた時鐘の間', floor: 'stone', wall: 'dark', accent: 'rust', light: 'cold' },
] as const;

function seat(g: Prop, x: number, z: number, broken = false) {
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const h = broken && side < 0 && end < 0 ? .16 : .45;
    g.box(x + side * .26, h / 2, z + end * .25, .065, h, .065, 'dark');
  }
  g.box(x, .47, z, .66, .075, .64, 'dark');
  for (const side of [-1, 1]) g.box(x + side * .26, .79, z + .25, .06, broken && side > 0 ? .39 : .79, .06, 'dark');
  if (!broken) for (const y of [.77, 1.02, 1.20]) g.box(x, y, z + .25, .57, .060, .048, 'dark');
  else g.box(x - .12, 1.14, z + .25, .31, .068, .050, 'dark');
  g.box(x, .522, z, .53, .024, .51, 'red');
}

function musicStand(g: Prop, x: number, z: number, scale = 1) {
  g.cylinder(x, .54 * scale, z, .014 * scale, 1.08 * scale, 'rust');
  g.box(x, .05 * scale, z, .57 * scale, .045 * scale, .07 * scale, 'black');
  g.box(x, .05 * scale, z, .07 * scale, .045 * scale, .49 * scale, 'black');
  g.box(x, 1.16 * scale, z, .64 * scale, .44 * scale, .045 * scale, 'black');
  g.box(x, .944 * scale, z - .047 * scale, .69 * scale, .035 * scale, .12 * scale, 'dark');
  for (const side of [-1, 1]) g.box(x + side * .147 * scale, 1.17 * scale, z - .028 * scale, .276 * scale, .371 * scale, .008 * scale, 'paper');
}

function stringInstrument(g: Prop, x: number, base: number, z: number, k: number) {
  const b = (dx: number, y: number, dz: number, w: number, h: number, d: number, m: Mat) => g.box(x + dx * k, base + y * k, z + dz * k, w * k, h * k, d * k, m);
  // Thin stepped bouts, a narrow waist and dark f-holes read as a bowed instrument.
  for (const [y, w, h] of [[.31, .27, .16], [.45, .40, .15], [.585, .31, .13], [.705, .19, .12], [.83, .34, .14], [.945, .25, .10], [1.025, .13, .07]]) b(0, y, 0, w, h, .105, 'red');
  b(0, 1.30, 0, .052, .52, .065, 'dark');
  g.cylinder(x, base + 1.60 * k, z, .034 * k, .09 * k, 'dark', .026 * k);
  b(0, .12, 0, .017, .24, .019, 'black');
  b(0, 1.025, -.061, .047, .99, .018, 'black');
  for (const side of [-1, 1]) {
    b(side * .115, .67, -.059, .019, .16, .017, 'black');
    b(side * .099, .585, -.06, .045, .021, .017, 'black');
  }
  for (const dx of [-.014, 0, .014]) b(dx, 1.0, -.075, .003, 1.09, .006, 'gold');
  b(0, .655, -.078, .145, .043, .015, 'paper');
  b(0, .407, -.072, .055, .19, .018, 'black');
  b(.29, .85, -.03, .014, 1.27, .017, 'dark');
  b(.315, .85, -.03, .006, 1.17, .011, 'paper');
  b(.30, .225, -.03, .061, .056, .033, 'gold');
}

function clockFace(g: Prop, x: number, y: number, z: number, r: number) {
  g.box(x, y, z, r * 2.18, r * 2.18, .044, 'gold');
  g.box(x, y, z - .027, r * 1.97, r * 1.97, .021, 'paper');
  for (let mark = 0; mark < 12; mark++) {
    const a = mark * Math.PI / 6;
    g.box(x + Math.sin(a) * r * .81, y + Math.cos(a) * r * .81, z - .046, .025, .025, .016, 'black');
  }
  g.box(x, y + r * .28, z - .058, .014, r * .61, .014, 'black');
  g.box(x - r * .20, y, z - .061, r * .43, .019, .014, 'black');
  g.box(x, y, z - .069, .044, .044, .014, 'gold');
}

/** Known reserved or undersized rooms are handled with zero furniture. */
export function buildOrchestraRoom(id: string, room: Room, builder: Builder, reserved = false): boolean {
  if (!ORCHESTRA_ROOMS.some(theme => theme.id === id)) return false;
  if (reserved || (room.x2 - room.x1 + 1) * 2 < 6 || (room.z2 - room.z1 + 1) * 2 < 6) return true;
  const cx = (room.x1 + room.x2) * 2, cz = (room.z1 + room.z2) * 2;
  const group = (sx: number, sz: number, draw: (g: Prop) => void) => {
    const commands: (() => void)[] = [];
    let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity, top = 0;
    const bounds = (x: number, y: number, z: number, rx: number, h: number, rz: number) => {
      x1 = Math.min(x1, x - rx); x2 = Math.max(x2, x + rx);
      z1 = Math.min(z1, z - rz); z2 = Math.max(z2, z + rz); top = Math.max(top, y + h / 2);
    };
    draw({
      box(x, y, z, w, h, d, m) { bounds(x, y, z, w / 2, h, d / 2); commands.push(() => builder.box(cx + sx * (4.05 + x), y, cz + sz * (4.05 + z), w, h, d, m)); },
      cylinder(x, y, z, r, h, m, rb = r) { bounds(x, y, z, Math.max(r, rb), h, Math.max(r, rb)); commands.push(() => builder.cylinder(cx + sx * (4.05 + x), y, cz + sz * (4.05 + z), r, h, m, rb)); },
    });
    if (!commands.length) return;
    if (Math.max(Math.abs(x1), Math.abs(x2), Math.abs(z1), Math.abs(z2)) > 1.38 || top > 3) throw new Error('Gothic furniture exceeds safe room bounds');
    commands.forEach(command => command());
    builder.block(cx + sx * (4.05 + (x1 + x2) / 2), cz + sz * (4.05 + (z1 + z2) / 2), x2 - x1 + .03, z2 - z1 + .03, top + .01);
  };

  if (id === 'orchestra-organ') {
    group(-1, -1, g => {
      g.box(0, .20, .17, 2.55, .40, .93, 'dark');
      g.box(0, .433, .17, 2.64, .075, 1.0, 'black');
      g.box(0, 1.54, .60, 2.46, 2.28, .06, 'black');
      for (const x of [-1.24, 1.24]) {
        g.box(x, 1.51, .32, .10, 2.40, .34, 'dark');
        g.cylinder(x, 2.80, .32, .004, .18, 'gold', .075);
      }
      g.box(0, 2.735, .34, 2.58, .09, .37, 'dark');
      for (let pipe = -4; pipe <= 4; pipe++) {
        const x = pipe * .244, h = 1.12 + (4 - Math.abs(pipe)) * .28, y = .46 + h / 2, r = .063 + (4 - Math.abs(pipe)) * .006;
        g.cylinder(x, y, .16, r, h, 'gold');
        g.cylinder(x, .46 + h, .16, r + .009, .024, 'gold');
        g.cylinder(x, .475 + h, .16, r * .76, .006, 'black');
        g.box(x, .68, .16 - r - .003, r * .90, .13, .014, 'black');
      }
    });
    group(1, -1, g => {
      g.box(0, .425, .10, 2.33, .85, .82, 'dark');
      g.box(0, .09, .10, 2.42, .18, .89, 'black');
      g.box(0, .904, .08, 2.56, .09, 1.00, 'dark');
      for (const side of [-1, 1]) g.box(side * 1.17, 1.04, .21, .075, .23, .70, 'dark');
      for (let manual = 0; manual < 2; manual++) {
        const y = .961 + manual * .105, z = -.24 + manual * .245;
        for (let key = 0; key < 26; key++) g.box(-1.038 + key * .083, y, z, .078, .033, .27, 'paper');
        for (let key = 0; key < 25; key++) if ([1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(key)) g.box(-.998 + key * .083, y + .031, z + .062, .041, .04, .17, 'black');
      }
      for (const side of [-1, 1]) for (let stop = 0; stop < 3; stop++) {
        g.cylinder(side * 1.115, 1.14, -.13 + stop * .185, .025, .065, 'gold');
        g.cylinder(side * 1.115, 1.184, -.13 + stop * .185, .039, .023, 'paper');
      }
      for (let pedal = 0; pedal < 13; pedal++) g.box(-.72 + pedal * .12, .05, -.72, .073, .046, .52, pedal % 3 === 0 ? 'black' : 'dark');
    });
    for (const x of [-.70, .70]) group(-1, 1, g => {
      for (const side of [-1, 1]) g.box(x + side * .24, .25, .03, .10, .50, .63, 'dark');
      g.box(x, .535, .03, .68, .075, .72, 'dark');
      g.box(x, .58, .03, .59, .020, .63, 'red');
      g.box(x, .18, .03, .51, .06, .08, 'black');
    });
    group(1, 1, g => {
      musicStand(g, -.42, -.20, 1.05);
      g.box(.80, .06, .48, .54, .12, .54, 'stone');
      g.cylinder(.80, .67, .48, .037, 1.13, 'gold');
      g.box(.80, 1.23, .48, .61, .037, .044, 'gold');
      for (const x of [.55, .80, 1.05]) {
        g.cylinder(x, 1.36, .48, .030, .24, 'gold');
        g.cylinder(x, 1.58, .48, .040, .24, 'paper');
      }
    });
  } else if (id === 'orchestra-strings') {
    for (const x of [-.68, .63]) group(-1, -1, g => {
      g.box(x, .021, .16, .55, .042, .46, 'black');
      g.cylinder(x, .23, .23, .017, .41, 'rust');
      g.box(x, .407, .14, .29, .04, .22, 'rust');
      stringInstrument(g, x, .015, .08, 1);
    });
    for (const x of [-.67, .67]) group(1, -1, g => {
      g.box(x, .04, .04, .53, .08, .46, 'black');
      g.cylinder(x, .42, .09, .020, .77, 'rust');
      g.box(x, .81, .04, .24, .039, .19, 'dark');
      stringInstrument(g, x, .69, .015, .56);
    });
    for (const x of [-.66, .66]) {
      group(-1, 1, g => musicStand(g, x, .59, 1));
      group(-1, 1, g => {
        g.cylinder(x, .45, -.58, .235, .08, 'dark');
        for (let leg = 0; leg < 3; leg++) {
          const a = leg * Math.PI * 2 / 3;
          g.box(x + Math.cos(a) * .16, .215, -.58 + Math.sin(a) * .16, .047, .43, .047, 'black');
        }
      });
    }
    for (const x of [-.63, .63]) group(1, 1, g => {
      g.box(x, .105, .0, .54, .21, 1.41, 'black');
      g.box(x, .219, .0, .45, .018, 1.30, 'red');
      g.box(x, .219, -.11, .37, .022, .79, 'black');
      g.box(x, .219, .50, .17, .022, .29, 'black');
      for (const side of [-1, 1]) g.box(x + side * .261, .261, 0, .036, .20, 1.42, 'dark');
      for (const z of [-.69, .69]) g.box(x, .261, z, .54, .20, .036, 'dark');
      g.box(x + .13, .238, .01, .012, .012, 1.16, 'gold');
      g.box(x + .268, .14, -.15, .034, .06, .15, 'gold');
    });
  } else if (id === 'orchestra-curtain') {
    for (const side of [-1, 1]) group(side, -1, g => {
      g.box(0, .105, .07, 2.59, .21, 2.45, 'dark');
      g.box(0, .047, -1.245, 2.20, .094, .15, 'stone');
      for (const x of [-1.25, 1.25]) g.box(x, 1.515, .88, .095, 2.64, .12, 'black');
      g.box(0, 2.865, .88, 2.65, .08, .16, 'gold');
      g.box(0, 2.744, .93, 2.60, .20, .11, 'red');
      for (let fold = -4; fold <= 4; fold++) {
        if (side > 0 && Math.abs(fold) < 3) continue;
        const x = fold * .268, h = 2.18 - Math.abs(fold) * .034;
        g.box(x, .34 + h / 2, .88 + (fold % 2 ? .035 : -.035), .253, h, .10, 'red');
        g.box(x, .353, .82, .21, .035, .045, 'gold');
      }
      for (const x of [-1.21, 1.21]) g.cylinder(x, 2.946, .88, .055, .055, 'gold');
      if (side > 0) {
        g.box(.13, .29, .19, .62, .12, .62, 'black');
        g.box(.13, .56, .19, .048, .45, .048, 'rust');
        g.box(.27, .79, .18, .34, .065, .23, 'dark');
      }
    });
    group(-1, 1, g => seat(g, -.69, .23, true));
    group(-1, 1, g => {
      g.box(.66, .067, .11, .67, .13, .64, 'dark');
      for (const x of [.395, .925]) g.box(x, .14, .64, .07, .08, .95, 'dark');
      g.box(.66, .155, 1.068, .60, .065, .06, 'dark');
      g.box(.64, .16, .035, .47, .022, .44, 'red');
      g.box(.91, .19, -.40, .08, .18, .08, 'dark');
    });
    group(1, 1, g => {
      seat(g, -.65, .50, true);
      for (let plank = 0; plank < 4; plank++) g.box(.50 + (plank % 2) * .13, .035 + plank * .025, -.52 + plank * .22, .70 - plank * .04, .04, .055, 'dark');
      g.box(.45, .048, .42, .065, .06, .94, 'dark');
      g.box(.90, .052, .24, .09, .07, .65, 'dark');
      g.box(.88, .103, -.56, .24, .027, .35, 'paper');
      g.box(.84, .131, -.55, .27, .022, .34, 'black');
    });
  } else {
    group(-1, -1, g => {
      g.box(0, .11, .11, 1.10, .22, .79, 'stone');
      g.box(0, 1.21, .11, .86, 2.08, .59, 'dark');
      g.box(0, 2.45, .11, 1.07, .36, .73, 'dark');
      g.box(0, 2.682, .11, 1.16, .09, .80, 'black');
      g.cylinder(0, 2.841, .11, .001, .22, 'gold', .135);
      g.box(0, .96, -.198, .58, 1.09, .025, 'black');
      for (const x of [-.32, .32]) g.box(x, 1.02, -.226, .036, 1.25, .043, 'gold');
      g.box(0, 1.03, -.225, .018, .91, .018, 'gold');
      g.cylinder(0, .562, -.232, .115, .15, 'gold');
      clockFace(g, 0, 2.092, -.22, .325);
      g.box(.28, .88, -.257, .035, .072, .034, 'gold');
    });
    group(1, -1, g => {
      for (const x of [-1.17, 1.17]) {
        g.box(x, 1.34, .19, .12, 2.68, .16, 'dark');
        g.box(x, .09, .19, .32, .18, .71, 'stone');
      }
      g.box(0, 2.716, .19, 2.56, .13, .23, 'dark');
      for (let bell = -1; bell <= 1; bell++) {
        const x = bell * .70, top = 2.36 - Math.abs(bell) * .18, h = .36 + (bell + 1) * .035, r = .205 + (bell + 1) * .022;
        g.cylinder(x, (2.65 + top) / 2, .19, .012, 2.65 - top, 'rust');
        g.cylinder(x, top - h / 2, .19, .062, h, 'gold', r);
        g.cylinder(x, top - h, .19, r + .012, .043, 'gold');
        g.cylinder(x, top - h - .025, .19, r * .82, .008, 'black');
        g.cylinder(x, top - h - .09, .19, .037, .13, 'rust');
      }
    });
    group(-1, 1, g => {
      for (const x of [-1.01, 1.01]) g.box(x, .37, .48, .12, .74, .64, 'dark');
      g.box(0, .78, .48, 2.30, .10, .82, 'dark');
      for (let item = -1; item <= 1; item++) {
        const x = item * .73;
        g.box(x, 1.124, .46, .62, .57, .34, 'dark');
        clockFace(g, x, 1.13, .276, .226);
        g.cylinder(x, 1.465, .46, .125, .10, 'rust', .07);
      }
    });
    group(-1, 1, g => {
      for (const x of [-.63, .63]) {
        g.cylinder(x, .043, -.77, .25, .086, 'rust');
        g.cylinder(x, .091, -.77, .080, .015, 'black');
        for (let tooth = 0; tooth < 10; tooth++) {
          const a = tooth * Math.PI / 5;
          g.box(x + Math.cos(a) * .27, .046, -.77 + Math.sin(a) * .27, .077, .07, .077, 'gold');
        }
      }
    });
    group(1, 1, g => {
      for (const x of [-1.02, 1.02]) {
        g.box(x, 1.32, .23, .075, 2.64, .075, 'black');
        g.box(x, .058, .23, .23, .115, .79, 'dark');
      }
      g.box(0, 2.64, .23, 2.15, .075, .14, 'black');
      for (let pipe = 0; pipe < 6; pipe++) {
        const x = -.78 + pipe * .31, h = 1.22 + pipe * .13;
        g.cylinder(x, 2.49 - h / 2, .23, .033, h, pipe % 2 ? 'gold' : 'rust');
        g.cylinder(x, 2.56, .23, .006, .16, 'rust');
        g.cylinder(x, 2.50, .23, .042, .025, 'black');
      }
      g.box(.73, .80, .30, .027, 1.22, .037, 'dark');
      g.cylinder(.73, 1.45, .30, .060, .11, 'paper');
    });
  }
  return true;
}
