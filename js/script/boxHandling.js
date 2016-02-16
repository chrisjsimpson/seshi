window.onload = function () { 

/*********************************************************************/

function isPlayable(fileName) {
	/* Mp3 */
	fileName = fileName.toLowerCase();
	if (fileName.indexOf('.mp3') > -1) {
		return true;
	}
	/* Mp4 */
	if (fileName.indexOf('.mp4') > -1) {
		return true;
	}
	/* webm */
	if (fileName.indexOf('.webm') > -1) {
		return true;
	}
	
	/* ogg */
	if (fileName.indexOf('.ogg') > -1) {
		return true;
	}

	/* ### Images ### */
	
	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return false;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return false;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return false;
        }

	/* ### Documents ### */

	/* pdf */
	        if (fileName.indexOf('.pdf') > -1) {
                return false;
        }
	
	// Presume playable 
	return true
} //End isPlayable()

function isImage(fileName) {

	/* MY FIDDLE: http://jsfiddle.net/fua75hpv/80/ */

	/* jpg */
	        if (fileName.indexOf('.jpg') > -1) {
                return true;
        }
	
	/* jpeg */
	        if (fileName.indexOf('.jpeg') > -1) {
                return true;
        }
	
	/* png */
	        if (fileName.indexOf('.png') > -1) {
                return true;
        }

	return false;
}//End isImage(fileName)

};

