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
})(document, 'img/plyricons/sprite.svg');

//hide all

$(".btn-hide").click(function() {
     $("#hideall").fadeToggle();
    // var txt = $("#hideall").is(':visible') ? 'Hide' : 'Show';
    if (!$("#hideall").is(':visible') ) {
        $('.btn-hide').find('i').toggleClass('fa-eye-slash')
    }
    //  $(".btn-hide").text(txt);

})

$('.dropfile').on('dragenter', function() {
    dropzoneenter();
    $('input[id="dropfileinput"]').show();
});

$('.dropfile').on('dragleave', function() {
    dropzoneleave();
    $('input[id="dropfileinput"]').hide();
});

$('.btn-upload').mouseenter( function(){
    dropzoneenter();
});

$('.btn-upload').mouseleave( function(){
    dropzoneleave();
});

function dropzoneenter() {
//     $('.dropfile')
//     .css({'background-color' : 'rgba(255,255,255,0.6)',
// });
    $('.dropfile').css({'opacity':'1',
                        'z-index': '1500'})
}

function dropzoneleave() {
    // $('.dropfile')
    // .css({'background-color' : ''});
    $('.dropfile').css({'opacity': '0',
                        'z-index': '1'});
}


//if audio player CSS change
// if($('.plyr').find('audio').length != 0) {
//     $('#hideall').css('position', 'relative');
//     $('.plyr').css({
//         'position': 'fixed',
//         'bottom': '0',
//         'width': '100%',
//         'z-index':'1001'
// 			});
// 		$('.btn-hide').hide();
// }
