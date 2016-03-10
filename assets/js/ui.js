/*!
 * Start Bootstrap - Grayscale Bootstrap Theme (http://startbootstrap.com)
 * Code licensed under the Apache License v2.0.
 * For details, see http://www.apache.org/licenses/LICENSE-2.0.
 */

// jQuery to collapse the navbar on scroll
$(document).ready(function() {

$(window).scroll(function() {
    if ($(".navbar").offset().top > 50) {
        $(".navbar-fixed-top").addClass("top-nav-collapse");
    } else {
        $(".navbar-fixed-top").removeClass("top-nav-collapse");
    }
});

// jQuery for page scrolling feature - requires jQuery Easing plugin
$(function() {
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 500, 'easeInOut');
        event.preventDefault();
    });
});

// Closes the Responsive Menu on Menu Item Click
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});

//Prevent chat box from close when clicked inside

$('.drop-up').click(function(e) {
       e.stopPropagation();
   });


//send key expand

$("#copyclipboard").click(function () {
    // $(".message-app-card").show();
    $(".keycopy").animate({
        width: '25%'
    });
    $(".copyclipboard-card ").animate({
        width: '100%'
    });

    $(".keycopy .copied").replaceWith('<h6 class="flashcopied"> Copied link! </h6>');

    $(".message-app-card").delay(400).fadeIn();

});

//hide the hidebutton on load

$('.btn-hide').hide();

//dropzone


$('.dropfile').on('dragenter', function() {
    dropzoneenter();

});

$('.dropfile').on('drop', function(e) {
   e.preventDefault();
    dropzoneleave();

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
                        'z-index': '1002'})
                        $('input[id="dropfileinput"]').show();
}

function dropzoneleave() {
    // $('.dropfile')
    // .css({'background-color' : ''});
    $('.dropfile').css({'opacity': '0',
                        'z-index': '999'});
                            $('input[id="dropfileinput"]').hide();
}




//scroll show extra upload button

var topOfOthDiv = $("#hideall").offset().top;
$(window).scroll(function() {
if($(window).scrollTop() > (topOfOthDiv - 130)) { //scrolled past the other div?
  $("#addmorefiles").css('opacity', '1') //reached the desired point -- show div
} else {
  $("#addmorefiles").css('opacity', '0')
}
});

// Google Maps Scripts
// When the window has finished loading create our google map below

//pyr plugin

});
