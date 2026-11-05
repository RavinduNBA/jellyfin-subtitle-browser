#pragma once

#include <QImage>

inline bool subtitleFrameHasContentImage(const QImage& image)
{
  if (image.isNull()) return false;
  const QImage sample = image.scaled(160, 100, Qt::IgnoreAspectRatio, Qt::FastTransformation).convertToFormat(QImage::Format_ARGB32);
  const QRgb background = sample.pixel(2, 50);
  int different = 0;
  for (int y = 3; y < 97; ++y)
    for (int x = 3; x < 157; ++x)
    {
      const QRgb pixel = sample.pixel(x, y);
      if (qAlpha(pixel) > 200 &&
          (qAbs(qRed(pixel) - qRed(background)) > 24 ||
           qAbs(qGreen(pixel) - qGreen(background)) > 24 ||
           qAbs(qBlue(pixel) - qBlue(background)) > 24))
        if (++different >= 80) return true;
    }
  return false;
}
