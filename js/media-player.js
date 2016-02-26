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

    var txt = $("#hideall").is(':visible') ? 'Show' : 'Hide';
     $(".btn-hide").text(txt);
     $("#hideall").fadeToggle();
    // if($(this).text() == 'show'){
    //        $(this).text('hide');
    //    }
    //    } else {
    //        $(this).text('show');
    //    }
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
		$('.btn-hide').hide();
}
