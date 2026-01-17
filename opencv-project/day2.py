import cv2

def rescale(frame,scale=0.75):
    width = int(frame.shape[1]*scale)
    height = int(frame.shape[0]*scale)

    dimensions = (width,height)

    return cv2.resize(frame , dimensions,interpolation=cv2.INTER_LINEAR )


img =cv2.imread('Anya.jpg')

cv2.imshow('hi',rescale(img))
cv2.waitKey(0)

