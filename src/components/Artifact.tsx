import type { CSSProperties } from "react";
import type { ArtifactKind } from "@/domain/model";

export function Artifact({
  kind,
  color,
  large = false,
}: {
  kind: ArtifactKind;
  color: string;
  large?: boolean;
}) {
  return (
    <div
      className={`artifact artifact-${kind} ${large ? "artifact-large" : ""}`}
      style={{ "--artifact-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <div className="artifact-grain" />
      <div className="artifact-orbit orbit-one" />
      <div className="artifact-orbit orbit-two" />
      <div className="artifact-object">
        {kind === "umbrella" && (
          <>
            <div className="umbrella-canopy">
              <i />
              <i />
              <i />
            </div>
            <div className="umbrella-stem" />
            <div className="umbrella-handle" />
            <div className="rain-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </>
        )}
        {kind === "clock" && (
          <>
            <div className="clock-face">
              <i className="clock-hand-one" />
              <i className="clock-hand-two" />
              <i className="clock-dot" />
            </div>
            <div className="clock-pedestal" />
            <span className="clock-mark">60</span>
          </>
        )}
        {kind === "bench" && (
          <>
            <div className="bench-seat seat-one" />
            <div className="bench-seat seat-two" />
            <div className="bench-leg leg-one" />
            <div className="bench-leg leg-two" />
            <div className="bench-dish" />
            <div className="bench-wave wave-one" />
            <div className="bench-wave wave-two" />
          </>
        )}
        {kind === "lamp" && (
          <>
            <div className="lamp-glow" />
            <div className="lamp-shade" />
            <div className="lamp-stem" />
            <div className="lamp-base" />
          </>
        )}
        {kind === "radio" && (
          <>
            <div className="radio-body">
              <div className="radio-speaker" />
              <div className="radio-dial" />
              <div className="radio-line" />
            </div>
            <div className="radio-aerial" />
            <div className="radio-signal" />
          </>
        )}
        {kind === "garden" && (
          <>
            <div className="garden-pot" />
            <div className="garden-stem" />
            <div className="garden-leaf leaf-one" />
            <div className="garden-leaf leaf-two" />
            <div className="garden-leaf leaf-three" />
            <div className="garden-sun" />
            <div className="garden-ground" />
          </>
        )}
      </div>
      <span className="artifact-caption">STUDY OF A POSSIBILITY</span>
      <span className="artifact-cross">+</span>
    </div>
  );
}
