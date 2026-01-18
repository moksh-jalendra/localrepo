import cv2 

cap = cv2.VideoCapture("testvid.mp4")


def rescale(frame ,scale=0.75):
    width = int(frame.shape[1]*scale )
    height = int(frame.shape[0]*scale)
    dimension=(width,height)

    return cv2.resize(frame , dimension , interpolation= cv2.INTER_LINEAR)



while True :
    isTrue , frame = cap.read()

    cv2.imshow("video",rescale(frame))

    if cv2.waitKey(20) & 0xFF == ord('d') :
        break

cap.release()
cv2.destroyAllWindows()










