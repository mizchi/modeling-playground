import type { Vec3 } from '../../../../modeling/types.ts';
/** Lower jaw landmarks are not scaled copies of a skull cross-section.
 * Columns run from chin center through the mandibular corner to the nape.
 * Keep the front narrow while retaining a wider corner behind the cheek. */
const landmarks: Record<string,(Vec3 | null)[]>={
  chin:[
    [0,1.750,.160],[.039,1.757,.151],[.079,1.774,.132],
    [.129,1.806,-.025],[.105,1.823,-.097],[.062,1.829,-.134],[0,1.831,-.148],
  ],
  jaw:[
    [0,1.785,.182],[.054,1.787,.174],[.105,1.798,.157],
    [.145,1.830,-.012],[.126,1.844,-.090],[.073,1.849,-.155],[0,1.850,-.180],
  ],
  lowerCheek:[null,null,null,[.161,1.850,0],[.143,1.858,-.098],[.077,1.861,-.170],[0,1.862,-.196]],
  mouth:[null,null,null,[.174,1.873,0],[.145,1.875,-.105],[.081,1.875,-.182],[0,1.875,-.210]],
};

export function base45JawPosition(role: string,column: number,side: number): Vec3 | null {
  const p=landmarks[role]?.[column];
  return p?[p[0]*side,p[1],p[2]]:null;
}

/** The attachment follows the throat and rises behind the jaw. A horizontal
 * neck rim at chin height would make the whole underside into a flat shelf. */
export function base45NeckAttachmentY(cosine: number) {
  return cosine>=0?1.790-.020*cosine:1.790-.025*cosine;
}
