uniform float uTime;
uniform vec3 uColor;

varying vec2 vUv;
varying vec3 vPosition;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
    float G = e;
    vec2 r = (G * sin(G * texCoord));
    return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * uv;
}

void main() {
    float uSpeed = .5;
    float uNoiseIntensity = 2.;
    float uRotation = .5;

    float rnd = noise(gl_FragCoord.xy);
    vec2 uv = rotateUvs(vUv, uRotation);
    vec2 tex = uv;
    float tOffset = uSpeed * uTime;

    tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

    float pattern = 0.6 +
        0.4 * sin(5.0 * (tex.x + tex.y +
        cos(3.0 * tex.x + 5.0 * tex.y) +
        0.02 * tOffset) +
        sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

    vec3 col = vec3(uColor) * vec3(pattern) - rnd / 15.0 * uNoiseIntensity;
    gl_FragColor = vec4(col, 1.0);
}
