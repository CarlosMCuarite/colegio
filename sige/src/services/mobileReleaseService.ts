export function compareBuild(currentVersion: string, currentBuild: number, releaseVersion: string, releaseBuild: number) {
  const parse = (v: string) => v.split('.').map(n => Number(n) || 0);
  const a = parse(currentVersion), b = parse(releaseVersion);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((b[i] || 0) !== (a[i] || 0)) return (b[i] || 0) > (a[i] || 0);
  }
  return releaseBuild > currentBuild;
}
