/** A live camera alone does not mean the proctor's detection models are running. */
export function cameraReady(camera: { status: string; detector: string }): boolean {
  return camera.status === "on" && camera.detector === "ready";
}
