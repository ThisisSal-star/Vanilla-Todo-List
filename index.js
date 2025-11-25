function commonSongs(playlistA, playlistB) {
  // Convert one playlist into a Set for faster lookup
  const setA = new Set(playlistA);

  // Filter songs in playlistB that are also in playlistA
  const common = playlistB.filter((song) => setA.has(song));

  return common;
}

// Example usage:
const playlistA = ["Hallelujah", "Shape of You", "Blinding Lights"];
const playlistB = ["Blinding Lights", "Shape of You", "Peaches"];

console.log(commonSongs(playlistA, playlistB));
// Output: ["Blinding Lights", "Shape of You"]
