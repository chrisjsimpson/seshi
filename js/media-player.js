/*
JS Modified from a tutorial found here:
http://www.inwebson.com/html5/custom-html5-video-controls-with-jquery/

I really wanted to learn how to skin html5 video.
*/

plyr.setup();

(function(d, p){
var a = new XMLHttpRequest(),
    b = d.body;
a.open('GET', p, true);
a.send();
a.onload = function() {
    var c = d.createElement('div');
    c.setAttribute('hidden', '');
    c.innerHTML = a.responseText;
    b.insertBefore(c, b.childNodes[0]);
};
})(document, 'https://cdn.plyr.io/1.5.14/sprite.svg');

//hide all
$(".btn-hide").click(function() {
    $("#hideall").fadeToggle();
    if($(this).text() == 'show'){
           $(this).text('hide');
       } else {
           $(this).text('show');
       }
})

//if audio player CSS change
if($('.plyr').find('audio').length != 0) {
    $('#hideall').css('position', 'relative');
    $('.plyr').css({
        'position': 'fixed',
        'bottom': '0',
        'width': '100%',
        'z-index':'1001'
});
} 


$(document).ready(function(){
	//INITIALIZE
	var video = $('#myVideo');

	//remove default control when JS loaded
	video[0].removeAttribute("controls");
	$('.control').fadeIn(500);
	$('.caption').fadeIn(500);

	//before everything get started
	video.on('loadedmetadata', function() {

		//set video properties
		$('.current').text(timeFormat(0));
		$('.duration').text(timeFormat(video[0].duration));
		updateVolume(0, 0.7);

		//bind video events
		$('.videoContainer')
		.hover(function() {
			$('.control').stop().fadeIn();
			$('.caption').stop().fadeIn();
		}, function() {
			if(!volumeDrag && !timeDrag){
				$('.control').stop().fadeOut();
				$('.caption').stop().fadeOut();
			}
		})
		.on('click', function() {
			$('.btnPlay').find('.icon-play').addClass('icon-pause').removeClass('icon-play');
			$(this).unbind('click');
			//video.play();
		});
	});

	//display current video play time
	video.on('timeupdate', function() {
		var currentPos = video[0].currentTime;
		var maxduration = video[0].duration;
		var perc = 100 * currentPos / maxduration;
		$('.timeBar').css('width',perc+'%');
		$('.current').text(timeFormat(currentPos));
	});

	//CONTROLS EVENTS
	//video screen and play button clicked
	video.on('click', function() { playpause(); } );
	$('.btnPlay').on('click', function() { playpause(); } );
	$('.closes').on('click', function(){
		video[0].pause();
	});
	var playpause = function() {
		if(video[0].paused || video[0].ended) {
			$('.btnPlay').addClass('paused');
			$('.btnPlay').find('.icon-play').addClass('icon-pause').removeClass('icon-play');
			video[0].play();
		}
		else {
			$('.btnPlay').removeClass('paused');
			$('.btnPlay').find('.icon-pause').removeClass('icon-pause').addClass('icon-play');
			video[0].pause();
		}
	};


	//fullscreen button clicked
	$('.btnFS').on('click', function() {
		if($.isFunction(video[0].webkitEnterFullscreen)) {
			video[0].webkitEnterFullscreen();
		}
		else if ($.isFunction(video[0].mozRequestFullScreen)) {
			video[0].mozRequestFullScreen();
		}
		else {
			alert('Your browsers doesn\'t support fullscreen');
		}
	});

	//sound button clicked
	$('.sound').click(function() {
		video[0].muted = !video[0].muted;
		$(this).toggleClass('muted');
		if(video[0].muted) {
			$('.volumeBar').css('width',0);
		}
		else{
			$('.volumeBar').css('width', video[0].volume*100+'%');
		}
	});

	//VIDEO EVENTS
	//video canplay event
	video.on('canplay', function() {
		$('.loading').fadeOut(100);
	});

	//video canplaythrough event
	//solve Chrome cache issue
	var completeloaded = false;
	video.on('canplaythrough', function() {
		completeloaded = true;
	});

	//video ended event
	video.on('ended', function() {
		$('.btnPlay').removeClass('paused');
		video[0].pause();
	});

	//video seeking event
	video.on('seeking', function() {
		//if video fully loaded, ignore loading screen
		if(!completeloaded) {
			$('.loading').fadeIn(200);
		}
	});

	//video seeked event
	video.on('seeked', function() { });

	//video waiting for more data event
	video.on('waiting', function() {
		$('.loading').fadeIn(200);
	});

	//VIDEO PROGRESS BAR
	//when video timebar clicked
	var timeDrag = false;	/* check for drag event */
	$('.progress').on('mousedown', function(e) {
		timeDrag = true;
		updatebar(e.pageX);
	});
	$(document).on('mouseup', function(e) {
		if(timeDrag) {
			timeDrag = false;
			updatebar(e.pageX);
		}
	});
	$(document).on('mousemove', function(e) {
		if(timeDrag) {
			updatebar(e.pageX);
		}
	});
	var updatebar = function(x) {
		var progress = $('.progress');

		//calculate drag position
		//and update video currenttime
		//as well as progress bar
		var maxduration = video[0].duration;
		var position = x - progress.offset().left;
		var percentage = 100 * position / progress.width();
		if(percentage > 100) {
			percentage = 100;
		}
		if(percentage < 0) {
			percentage = 0;
		}
		$('.timeBar').css('width',percentage+'%');
		video.currentTime = maxduration * percentage / 100;
	};

	//VOLUME BAR
	//volume bar event
	var volumeDrag = false;
	$('.volume').on('mousedown', function(e) {
		volumeDrag = true;
		video[0].muted = false;
		$('.sound').removeClass('muted');
		updateVolume(e.pageX);
	});
	$(document).on('mouseup', function(e) {
		if(volumeDrag) {
			volumeDrag = false;
			updateVolume(e.pageX);
		}
	});
	$(document).on('mousemove', function(e) {
		if(volumeDrag) {
			updateVolume(e.pageX);
		}
	});
	var updateVolume = function(x, vol) {
		var volume = $('.volume');
		var percentage;
		//if only volume have specificed
		//then direct update volume
		if(vol) {
			percentage = vol * 100;
		}
		else {
			var position = x - volume.offset().left;
			percentage = 100 * position / volume.width();
		}

		if(percentage > 100) {
			percentage = 100;
		}
		if(percentage < 0) {
			percentage = 0;
		}

		//update volume bar and video volume
		$('.volumeBar').css('width',percentage+'%');
		video[0].volume = percentage / 100;

		//change sound icon based on volume
		if(video[0].volume == 0){
			$('.sound').removeClass('sound2').addClass('muted');
		}
		else if(video[0].volume > 0.5){
			$('.sound').removeClass('muted').addClass('sound2');
		}
		else{
			$('.sound').removeClass('muted').removeClass('sound2');
		}

	};

	//Time format converter - 00:00
	var timeFormat = function(sec_num){
		// var m = Math.floor(seconds/60)<10 ? Math.floor(seconds/60) : Math.floor(seconds/60);
		// var s = Math.floor(seconds-(m*60))<10 ? "0"+Math.floor(seconds-(m*60)) : Math.floor(seconds-(m*60));
		// return m+":"+s;
		 var hours   = Math.floor(sec_num / 3600);
		 var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
		 var seconds = sec_num - (hours * 3600) - (minutes * 60);
		 seconds = Math.round(seconds);
		 return (hours > 0 ? hours + ":" : "") + (minutes > 0 ? minutes +":"  : "0:") + (seconds  < 10 ? "0" + seconds : seconds);
	};
	var vid = document.getElementById("myVideo");

	vid.addEventListener('loadedmetadata', function() {

	document.getElementById("duration").innerHTML = timeFormat(vid.duration);
	});

	// var timeDuration = timeFormat(vid.duration);
	// $('.duration').append(timeDuration);

	vid.ontimeupdate = function() {myFunction()};

			function myFunction() {
	// Display the current position of the video in a p element with id="demo"
	document.getElementById("time-position").innerHTML = timeFormat(vid.currentTime);
	}



});
