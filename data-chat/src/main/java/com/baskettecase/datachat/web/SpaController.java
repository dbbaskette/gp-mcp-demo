package com.baskettecase.datachat.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {
    @GetMapping({"/", "/settings", "/settings/**"})
    public String forward() { return "forward:/index.html"; }
}
