// 驗證 CodeWalk 語法高亮用的示範檔案——不參與建置。

import 'dart:async';

/// Dart 的三斜線文件註解自成一種 token,與一般 `//` 註解顏色不同。
class Greeter {
  const Greeter(this.names);

  final List<String> names;

  String greet(String name) => 'Hello, $name!';

  /// 字串內插(`$name` 與 `${...}`)加上 async/await,
  /// 是 Dart 高亮最有代表性的兩個特徵。
  Future<String> greetAll() async {
    final greetings = <String>[];
    for (final name in names) {
      await Future<void>.delayed(const Duration(milliseconds: 1));
      greetings.add(greet(name));
    }
    return greetings.join('\n');
  }

  @override
  String toString() => 'Greeter(${names.length} names)';
}

void main() async {
  const greeter = Greeter(['Shane', 'CodeWalk']);
  print(await greeter.greetAll());
}
