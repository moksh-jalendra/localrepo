import cv2

def rescale(frame,scale=0.75):
    width = int(frame.shape[1]*scale)
    # shape[1] is used for height 
    height = int(frame.shape[0]*scale)
    # shape[0] is used for width 

    # we multply by sccale to height and weidth to change its scale 

    dimensions = (width,height)
    # we use dimension latter for change its size 

    return cv2.resize(frame , dimensions,interpolation=cv2.INTER_LINEAR )
# its return frame with resized value 
# cv2.resize is function which we use for change its dimension 


img =cv2.imread('Anya.jpg')

# cv2.imread() is used for show image 

cv2.imshow('hi',rescale(img))

# here we used cv2.imshow () and call rescale functioon 
cv2.waitKey(0)

