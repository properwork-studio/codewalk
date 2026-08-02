package com.example.codewalk;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 驗證 CodeWalk 語法高亮用的示範檔案——不參與建置,
 * 只被 .codewalk/ 的示範導讀當作 snippet 來源引用。
 */
public class Greeter {

    /** text block 是跨行字串,用來驗證跨行 span 被逐行切開後標籤仍然配對完整。 */
    private static final String BANNER = """
        CodeWalk
        syntax highlight demo
        """;

    private final List<String> names;

    public Greeter(List<String> names) {
        this.names = names;
    }

    public String greetAll() {
        return names.stream()
                .filter(name -> !name.isBlank())
                .map(name -> "Hello, " + name + "!")
                .collect(Collectors.joining("\n"));
    }

    @Override
    public String toString() {
        return "Greeter(names=%d)".formatted(names.size());
    }

    public static void main(String[] args) {
        System.out.println(BANNER);
        System.out.println(new Greeter(List.of("Shane", "CodeWalk")).greetAll());
    }
}
