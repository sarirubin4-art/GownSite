// Turns an Ad's stored ImageFocalX/Y (0-1, defaulting to centered) into the CSS
// object-position value that reproduces the same crop the owner chose in
// ImagePositionEditor, wherever the image is displayed with objectFit: 'cover'.
export const focalObjectPosition = (focalX, focalY) =>
    `${(focalX ?? 0.5) * 100}% ${(focalY ?? 0.5) * 100}%`;
