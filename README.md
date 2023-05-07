# dist

Find the closest of your photos to a given location.

## Installation

- Use [flickrdownloadr][] to grab a copy of your photos and metadata.
  - Good luck with this; it's been unmaintained for a decade.
  - If you succeed, save a copy of its `index.xml` to your home directory as `photos.xml`
- Install `node` and `yarn`
- Clone the repo
- `yarn install`

## Use

```
yarn calc 40:43:35N 73:58:54W
```

The lat/lng parameters can be in any format and order supported by [geographiclib][]. If you specify hemispheres (as `N`, `S`, `E`, `W`), you can write the coordinates in any order; if you use numbers with `-` for the South and Western hemispheres, the latitude comes before the longitude.

[flickrdownloadr]: https://github.com/dssouza/flickrdownload
[geographiclib]: https://geographiclib.sourceforge.io/JavaScript/doc/module-DMS.html#.Decode
