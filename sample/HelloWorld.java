package sample;

public class HelloWorld {
    public static void main(String[] args) {
        sayHello("World");
        sayGoodbye();
    }

    public static void sayHello(String name) {
        System.out.println("Hello, " + name + "!");
    }

    public static void sayGoodbye() {
        System.out.println("Goodbye!");
    }
}
