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
   //  $(".keycopy").animate({
   //      width: '25%'
   //  });

   if ($(window).width() < 768) {
      $('.keycopy').css('float', 'left');
      $(".copyclipboard-card ").css({
          width: '100%'
      });
      $(".uploadbox-connect").css('height', '451px')
      $(".copyclipboard-card ").css({
          width: '100%'
      });
   } else {
    $(".copyclipboard-card ").css({
        width: '75%'
    });
}

    $(".flashcopied").replaceWith('<h6 class="flashcopied"> Copied link! </h6>');

    $(".copyclipboard-card").css('opacity', '1');

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




(function(window) {
    function triggerCallback(e, callback) {
      if(!callback || typeof callback !== 'function') {
        return;
      }
      var files;
      if(e.dataTransfer) {
        files = e.dataTransfer.files;
      } else if(e.target) {
        files = e.target.files;
      }
      callback.call(null, files);
    }


    function makeDroppable(ele, callback) {
      var input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('multiple', true);
      input.style.display = 'none';
      input.addEventListener('change', function(e) {
        triggerCallback(e, callback);
      });
      ele.appendChild(input);

      ele.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
          ele.style.zIndex = '3';
          $(".dropit").css('background-color', 'rgba(0,0,0,0.2)');
        ele.classList.add('dragover');

      });

      ele.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
         ele.style.zIndex = '1';
         $(".dropit").css('background-color', 'rgba(255,255,255,0.6)');
        ele.classList.remove('dragover');

      });

      ele.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        ele.classList.remove('dragover');
        ele.style.zIndex = '1';
        $(".dropit").css('background-color', 'rgba(255,255,255,0.6)');
        storeFile(this.files);
        triggerCallback(e, callback);
      });

      // ele.addEventListener('click', function() {
      //   input.value = null;
      //   input.click();
      // });
    }
    window.makeDroppable = makeDroppable;
  })(this);
  (function(window) {
    makeDroppable(window.document.querySelector('.demo-droppable'), function(files) {
      console.log(files);
      // var output = document.querySelector('.output');
      // output.innerHTML = '';
      // for(var i=0; i<files.length; i++) {
      //   output.innerHTML += '<p>'+files[i].name+'</p>';
      // }
    });
  })(this);
